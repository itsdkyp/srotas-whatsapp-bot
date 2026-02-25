const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');

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
        icon: path.join(__dirname, 'public', 'favicon.ico') // Optional: Add if we have an icon
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
    const serverPath = path.join(__dirname, 'server.js');
    const userDataPath = app.getPath('userData');

    // Use spawn to run the node server with dynamic port
    serverProcess = spawn(process.execPath, [serverPath], {
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            APP_USER_DATA_PATH: userDataPath,
            PORT: '0' // 0 tells Express/Node to pick an available dynamic port
        },
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
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server process:', err);
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
