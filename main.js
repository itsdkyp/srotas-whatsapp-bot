const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

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

    // Load the app (wait a bit for the server to start)
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000'); // Assuming port 3000, adjust if different
    }, 2000);

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

    // Use spawn to run the node server
    serverProcess = spawn(process.execPath, [serverPath], {
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            APP_USER_DATA_PATH: userDataPath
        },
        stdio: 'inherit'
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server process:', err);
    });
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

// Kill the Express server when Electron closes
app.on('quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
