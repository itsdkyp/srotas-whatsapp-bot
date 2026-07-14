#!/usr/bin/env node
// Stages everything the Tauri build needs to run the existing Node backend
// as a sidecar: a pinned Node.js runtime binary (renamed per Rust target
// triple, per Tauri's externalBin convention) and a production-only copy of
// server.js + its dependencies as bundle resources.
//
// The two must come from the EXACT same Node version/OS/arch, or
// better-sqlite3's prebuilt native addon (matched via prebuild-install to
// whatever Node runs `npm ci`) will fail to load against the sidecar's Node
// with a NODE_MODULE_VERSION mismatch at runtime. That constraint is why
// this script downloads the runtime AND stages node_modules together,
// instead of two independent steps.
import { existsSync, mkdirSync, rmSync, cpSync, chmodSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const NODE_VERSION = 'v22.23.1'; // Pinned Node 22 LTS ("Jod") — bump deliberately, in lockstep with a re-run of this script.

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const TAURI_DIR = path.join(REPO_ROOT, 'src-tauri');
const BINARIES_DIR = path.join(TAURI_DIR, 'binaries');
const RESOURCES_DIR = path.join(TAURI_DIR, 'resources', 'server-app');
const WORK_DIR = path.join(TAURI_DIR, '.sidecar-work');

// Maps a Rust target triple to the matching Node.js dist archive naming.
const TARGETS = {
    'aarch64-apple-darwin': { nodePlatform: 'darwin-arm64', archiveExt: 'tar.gz', binName: 'node' },
    'x86_64-apple-darwin': { nodePlatform: 'darwin-x64', archiveExt: 'tar.gz', binName: 'node' },
    'x86_64-pc-windows-msvc': { nodePlatform: 'win-x64', archiveExt: 'zip', binName: 'node.exe' },
    'x86_64-unknown-linux-gnu': { nodePlatform: 'linux-x64', archiveExt: 'tar.gz', binName: 'node' },
};

function hostTargetTriple() {
    const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
    const match = out.match(/host: (\S+)/);
    if (!match) throw new Error('Could not determine host target triple from `rustc -vV`');
    return match[1];
}

async function downloadFile(url, destPath) {
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText} (${url})`);
    await pipeline(res.body, createWriteStream(destPath));
}

function extractArchive(archivePath, destDir, ext) {
    mkdirSync(destDir, { recursive: true });
    if (ext === 'tar.gz') {
        execFileSync('tar', ['-xzf', archivePath, '-C', destDir, '--strip-components=1']);
    } else if (ext === 'zip') {
        // Windows runners have `tar` too (bsdtar, ships with Windows 10+), which
        // can also extract zip — avoids depending on PowerShell-specific cmdlets.
        execFileSync('tar', ['-xf', archivePath, '-C', destDir, '--strip-components=1']);
    } else {
        throw new Error(`Unknown archive extension: ${ext}`);
    }
}

async function stageForTarget(targetTriple) {
    const target = TARGETS[targetTriple];
    if (!target) {
        throw new Error(`No Node dist mapping for target triple "${targetTriple}". Add one to TARGETS in this script.`);
    }

    console.log(`\n=== Staging sidecar for ${targetTriple} (Node ${NODE_VERSION}, ${target.nodePlatform}) ===`);

    mkdirSync(WORK_DIR, { recursive: true });
    mkdirSync(BINARIES_DIR, { recursive: true });

    const archiveName = `node-${NODE_VERSION}-${target.nodePlatform}.${target.archiveExt}`;
    const archivePath = path.join(WORK_DIR, archiveName);
    const extractDir = path.join(WORK_DIR, `extracted-${targetTriple}`);

    if (!existsSync(archivePath)) {
        await downloadFile(`https://nodejs.org/dist/${NODE_VERSION}/${archiveName}`, archivePath);
    } else {
        console.log(`Using cached ${archiveName}`);
    }

    rmSync(extractDir, { recursive: true, force: true });
    extractArchive(archivePath, extractDir, target.archiveExt);

    // 1. Place the renamed Node binary at src-tauri/binaries/node-<target-triple>[.exe]
    //    — Tauri's externalBin convention: config lists "binaries/node", and at
    //    build time it looks for "binaries/node-<current target triple>".
    const isWindows = target.binName.endsWith('.exe');
    const srcBinPath = isWindows
        ? path.join(extractDir, 'node.exe')
        : path.join(extractDir, 'bin', 'node');
    const destBinName = isWindows ? `node-${targetTriple}.exe` : `node-${targetTriple}`;
    const destBinPath = path.join(BINARIES_DIR, destBinName);
    cpSync(srcBinPath, destBinPath);
    if (!isWindows) chmodSync(destBinPath, 0o755);

    // The official Node.js binary ships with hardened runtime enabled and a
    // real Apple-notarized signature. Hardened runtime enforces strict
    // library validation by default — it will silently kill the process
    // (no JS error, no crash trace, just an instant exit) the moment it
    // tries to load our own ad-hoc-signed better-sqlite3.node addon, since
    // that's signed by a different (non-)identity. Re-sign the binary with
    // the disable-library-validation entitlement so it can load native
    // addons we didn't sign with Node's own certificate — the same class of
    // fix needed earlier for Electron's own native-module loading, one
    // level up the chain.
    if (targetTriple.includes('apple-darwin')) {
        const entitlementsPath = path.join(TAURI_DIR, 'entitlements-sidecar.plist');
        execFileSync('codesign', [
            '--force',
            '--sign', '-',
            '--options', 'runtime',
            '--entitlements', entitlementsPath,
            destBinPath,
        ]);
        console.log(`Re-signed ${destBinName} with disable-library-validation entitlement`);
    }

    console.log(`Staged sidecar binary: src-tauri/binaries/${destBinName}`);

    // 2. Stage server.js + src/** + public/ (server.js serves this via
    //    express.static) as plain resources.
    rmSync(RESOURCES_DIR, { recursive: true, force: true });
    mkdirSync(RESOURCES_DIR, { recursive: true });
    cpSync(path.join(REPO_ROOT, 'server.js'), path.join(RESOURCES_DIR, 'server.js'));
    cpSync(path.join(REPO_ROOT, 'src'), path.join(RESOURCES_DIR, 'src'), { recursive: true });
    cpSync(path.join(REPO_ROOT, 'public'), path.join(RESOURCES_DIR, 'public'), { recursive: true });
    cpSync(path.join(REPO_ROOT, 'package.json'), path.join(RESOURCES_DIR, 'package.json'));
    cpSync(path.join(REPO_ROOT, 'package-lock.json'), path.join(RESOURCES_DIR, 'package-lock.json'));

    // 3. `npm ci --omit=dev` using the SAME downloaded Node/npm, so
    //    better-sqlite3's prebuild-install fetches the addon matching this
    //    exact runtime (not whatever Node happens to be on the host PATH).
    const npmCliPath = isWindows
        ? path.join(extractDir, 'node_modules', 'npm', 'bin', 'npm-cli.js')
        : path.join(extractDir, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');

    // Node 22.23.1 bundles npm 10.x, which predates npm 11's lifecycle-script
    // approval gate (the one that blocked electron's postinstall earlier this
    // session) — so no approval step is needed here, unlike with the
    // system's newer npm.
    //
    // Critical: better-sqlite3's install script (`prebuild-install ||
    // node-gyp rebuild`) resolves through a `#!/usr/bin/env node` shebang,
    // which looks up `node` via PATH — NOT via this process's execPath.
    // If the ambient PATH has a different Node ahead of the pinned one
    // (e.g. a Homebrew install), prebuild-install runs under THAT Node and
    // fetches/builds the addon for the wrong NODE_MODULE_VERSION, silently
    // producing a sidecar that crashes with an ABI mismatch at runtime.
    // Force the pinned Node's own bin dir to the front of PATH so every
    // shebang'd child process (this npm's own script, prebuild-install,
    // node-gyp) resolves back to the exact same binary being bundled.
    console.log('Running npm ci --omit=dev with the pinned Node runtime...');
    const pinnedBinDir = path.dirname(srcBinPath);
    execFileSync(srcBinPath, [npmCliPath, 'ci', '--omit=dev'], {
        cwd: RESOURCES_DIR,
        stdio: 'inherit',
        env: {
            ...process.env,
            PATH: `${pinnedBinDir}${path.delimiter}${process.env.PATH}`,
        },
    });

    console.log(`Staged resources: src-tauri/resources/server-app (for ${targetTriple})`);
}

const requestedTarget = process.argv[2] || hostTargetTriple();
await stageForTarget(requestedTarget);
console.log('\nDone. Remember: re-run this script for every target triple you plan to bundle for.');
