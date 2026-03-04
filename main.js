const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');

// ════════════════════════════════════════════════
// BACKGROUND SERVER MODE
// If started with this flag, run the backend Express server instead of the UI.
// This is necessary because ELECTRON_RUN_AS_NODE breaks ASAR support on Windows.
// ════════════════════════════════════════════════
if (process.argv.includes('--run-server')) {
    // Run the server and stop Electron from initializing the UI
    require('./server.js');
    return;
}

let mainWindow;
let serverProcess;

// Acquire single instance lock early
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.on('ready', createWindow);

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', function () {
        if (mainWindow === null) {
            createWindow();
        }
    });

    app.on('before-quit', () => {
        killServerProcess();
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false, // Security best practice
            contextIsolation: true,
        },
        icon: path.join(__dirname, 'public', 'icon.png') // App window icon
    });

    // Start the Express server
    startServer();

    // The loadURL will be handled dynamically inside startServer() 
    // when it receives the "Server running on port X" stdout message

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function startServer() {
    const userDataPath = app.getPath('userData');
    const fs = require('fs');
    const crashLogPath = require('path').join(userDataPath, 'crash.log');

    // Create a pristine child environment without the RUN_AS_NODE flag
    const childEnv = Object.assign({}, process.env, {
        APP_USER_DATA_PATH: userDataPath,
        PORT: '0',
        PACKAGED_ELECTRON: app.isPackaged ? 'true' : ''
    });
    delete childEnv.ELECTRON_RUN_AS_NODE;

    try {
        fs.appendFileSync(crashLogPath, `[Spawning] ExecPath: ${process.execPath}, AppPath: ${app.getAppPath()}\n`);
    } catch (e) { }

    // Use spawn to run the node server as a native Electron process
    // This ensures full ASAR support on Windows!
    serverProcess = spawn(process.execPath, [app.getAppPath(), '--run-server'], {
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe'] // Pipe rather than inherit to capture stdout
    });

    let portFound = false;

    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // Forward to the electron console for debugging
        console.log(`[Server] ${output}`);

        // Listen for our special port print sequence
        if (!portFound) {
            const match = output.match(/SERVER_PORT=(\d+)/);
            if (match && match[1]) {
                portFound = true;
                const port = match[1];
                console.log(`[Electron] Detected server running on dynamic port ${port}`);
                if (mainWindow) {
                    mainWindow.loadURL(`http://localhost:${port}`);
                }
            }
        }
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error] ${data.toString()}`);
        try { fs.appendFileSync(crashLogPath, `[Server Stderr] ${data.toString()}\n`); } catch (e) { }
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server process:', err);
        try { fs.appendFileSync(crashLogPath, `[Spawn Error] ${err.message}\n`); } catch (e) { }
    });

    serverProcess.on('exit', (code, signal) => {
        try { fs.appendFileSync(crashLogPath, `[Server Exit] Code: ${code}, Signal: ${signal}\n`); } catch (e) { }
    });
}

function killServerProcess() {
    if (!serverProcess) return;

    const pid = serverProcess.pid;
    if (!pid) return;

    try {
        if (process.platform === 'win32') {
            // On Windows, use taskkill with /T flag to kill the entire process tree
            // This ensures child processes (like Puppeteer/Chromium) are also killed
            execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
        } else {
            serverProcess.kill('SIGTERM');
        }
    } catch (e) {
        // Process may have already exited
    }

    serverProcess = null;
}

// Global error handler for the main process to catch uncaught exceptions
process.on('uncaughtException', (err) => {
    try {
        const fs = require('fs');
        fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), `[Main Error] ${err.message}\n${err.stack}\n`);
    } catch (e) { }
});

