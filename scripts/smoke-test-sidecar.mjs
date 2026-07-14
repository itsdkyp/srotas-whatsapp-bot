#!/usr/bin/env node
// Cheap pre-flight check for the exact bug this migration hit once already:
// a NODE_MODULE_VERSION mismatch between the staged sidecar Node binary and
// better-sqlite3's native addon (caused, in that instance, by npm ci
// resolving a *different* Node via ambient PATH — see
// scripts/stage-tauri-sidecar.mjs's PATH-prepending fix). Run this right
// after staging, in CI and locally, so a mismatch fails fast with a clear
// message instead of surfacing as a silent, hard-to-diagnose crash inside a
// packaged installer.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const TAURI_DIR = path.join(REPO_ROOT, 'src-tauri');
const RESOURCES_DIR = path.join(TAURI_DIR, 'resources', 'server-app');

function hostTargetTriple() {
    const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
    const match = out.match(/host: (\S+)/);
    if (!match) throw new Error('Could not determine host target triple from `rustc -vV`');
    return match[1];
}

const targetTriple = process.argv[2] || hostTargetTriple();
const isWindows = targetTriple.includes('windows');
const binName = isWindows ? `node-${targetTriple}.exe` : `node-${targetTriple}`;
const binPath = path.join(TAURI_DIR, 'binaries', binName);

if (!existsSync(binPath)) {
    throw new Error(`Staged sidecar binary not found: ${binPath} — run scripts/stage-tauri-sidecar.mjs first.`);
}
if (!existsSync(RESOURCES_DIR)) {
    throw new Error(`Staged resources not found: ${RESOURCES_DIR} — run scripts/stage-tauri-sidecar.mjs first.`);
}

console.log(`Smoke-testing ${binName} against ${RESOURCES_DIR}...`);

const output = execFileSync(binPath, ['-e', "require('better-sqlite3'); console.log('SMOKE_TEST_OK')"], {
    cwd: RESOURCES_DIR,
    encoding: 'utf8',
});

if (!output.includes('SMOKE_TEST_OK')) {
    throw new Error(`Unexpected smoke-test output:\n${output}`);
}

console.log('Smoke test passed: better-sqlite3 loads cleanly under the staged sidecar binary.');
