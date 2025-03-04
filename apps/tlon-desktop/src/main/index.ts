import { BrowserWindow, app, ipcMain, session } from 'electron';
import path from 'path';

import store from './store';

// Import CommonJS wrappers
const checkIsDev = require('../../is-dev-wrapper.cjs');
const getFetch = require('../../fetch-wrapper.cjs');

let mainWindow: BrowserWindow | null = null;
let currentShipUrl: string | null = null;

async function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, '../../src/preload/preload.js'),
      webSecurity: false,
    },
  });

  // Configure session for CORS handling
  // const webSession = mainWindow.webContents.session;

  // webSession.webRequest.onBeforeSendHeaders((details, callback) => {
  //   // Only modify headers for requests to the configured ship
  //   if (currentShipUrl && details.url.startsWith(currentShipUrl)) {
  //     callback({
  //       requestHeaders: details.requestHeaders,
  //     });
  //   } else {
  //     callback({ requestHeaders: details.requestHeaders });
  //   }
  // });

  // webSession.webRequest.onHeadersReceived((details, callback) => {
  //   // Only modify headers for responses from the configured ship
  //   if (currentShipUrl && details.url.startsWith(currentShipUrl)) {
  //     console.log('Setting CORS headers for response from', currentShipUrl);

  //     if (details.method === 'OPTIONS') {
  //       console.log('Setting CORS headers for OPTIONS request');
  //       callback({
  //         responseHeaders: {
  //           ...details.responseHeaders,
  //           'Access-Control-Allow-Origin': ['http://localhost:3000'],
  //           'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
  //           'Access-Control-Allow-Headers': [
  //             'Content-Type, Authorization, Cookie',
  //           ],
  //           'Access-Control-Allow-Credentials': ['true'],
  //           // Force a 200 status for OPTIONS requests
  //           status: ['200'],
  //           statusText: ['OK'],
  //         },
  //       });
  //     } else {
  //       console.log('Setting CORS headers for non-OPTIONS request');
  //       callback({
  //         responseHeaders: {
  //           ...details.responseHeaders,
  //           'Access-Control-Allow-Origin': ['http://localhost:3000'],
  //           'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
  //           'Access-Control-Allow-Headers': [
  //             'Content-Type, Authorization, Cookie',
  //           ],
  //           'Access-Control-Allow-Credentials': ['true'],
  //         },
  //       });
  //     }
  //   } else {
  //     callback({ responseHeaders: details.responseHeaders });
  //   }
  // });

  // Load the app
  if (await checkIsDev()) {
    // In development, load from the dev server
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built app
    mainWindow.loadFile(
      path.join(__dirname, '../../tlon-web-new/dist/index.html')
    );
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle IPC messages
ipcMain.handle('set-urbit-ship', async (_event, shipUrl: string) => {
  console.log('Setting ship URL:', shipUrl);
  currentShipUrl = shipUrl;
  await store.set('shipUrl', shipUrl);
  return true;
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

// Handle login request
ipcMain.handle(
  'login-to-ship',
  async (
    _event,
    { shipUrl, accessCode }: { shipUrl: string; accessCode: string }
  ) => {
    console.log('Logging in to ship:', shipUrl);
    try {
      const fetch = await getFetch();
      const response = await fetch(`${shipUrl}/~/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Origin: shipUrl,
        },
        body: `password=${accessCode}`,
      });

      if (response.status < 200 || response.status > 299) {
        throw new Error('Failed to authenticate. Is your access code correct?');
      }

      const cookie = response.headers.get('set-cookie')?.split(';')[0];
      if (!cookie) {
        throw new Error('No auth cookie received from ship');
      }

      console.log('Login successful');
      return cookie;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
);
