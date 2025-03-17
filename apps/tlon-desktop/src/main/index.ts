import { fetch } from 'cross-fetch';
import crypto from 'crypto';
import { BrowserWindow, app, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';

import { setupNotificationService } from './notification-service';
import { setupSQLiteIPC } from './sqlite-service';
import store from './store';

// Encryption utilities for secure storage of auth cookie
const IV_LENGTH = 16; // For AES, this is always 16 bytes

// Function to get or create the encryption key - must be called after app is ready
async function getEncryptionKey(): Promise<Buffer> {
  try {
    // Try to get existing key
    const storedKey = await store.get('encryptionKey');
    if (storedKey) {
      console.log('Successfully retrieved existing encryption key');
      return Buffer.from(storedKey, 'hex');
    }

    // Generate a new key if none exists
    console.log('No encryption key found, generating new key');
    const newKey = crypto.randomBytes(32);
    await store.set('encryptionKey', newKey.toString('hex'));
    return newKey;
  } catch (error) {
    console.error('Error managing encryption key:', error);
    console.error('User data path:', app.getPath('userData'));
    console.error('App is packaged:', app.isPackaged);

    // Instead of generating a new random key (which would break decryption),
    // try one more time with a small delay
    console.log('Retrying key retrieval after brief delay...');

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const retryStoredKey = await store.get('encryptionKey');
          if (retryStoredKey) {
            console.log('Successfully retrieved encryption key on retry');
            resolve(Buffer.from(retryStoredKey, 'hex'));
          } else {
            // Only generate a new key if we're certain the old one doesn't exist
            console.log('No encryption key found on retry, generating new key');
            const newKey = crypto.randomBytes(32);
            await store.set('encryptionKey', newKey.toString('hex'));
            resolve(newKey);
          }
        } catch (retryError) {
          console.error(
            'Failed to retrieve encryption key on retry:',
            retryError
          );
          reject(retryError);
        }
      }, 500); // Small delay to allow store to initialize if that's the issue
    });
  }
}

// We'll initialize this once the app is ready
let ENCRYPTION_KEY: Buffer;

let cachedShipUrl: string | null = null;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Auth info interface
interface AuthInfo {
  ship: string;
  shipUrl: string;
  authCookie: string;
}

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, '../../build/main/preload.js'),
      // SECURITY NOTE: webSecurity is disabled to allow communication with local Urbit ships
      // This is necessary because Urbit doesn't properly handle CORS/OPTIONS preflight requests
      // for SSE connections (it just prints `eyre: session not a put` and doesn't respond).
      // Long-term, we should implement a more secure solution.
      webSecurity: false,
    },
  });

  setupNotificationService(mainWindow);

  const webSession = mainWindow.webContents.session;

  // Add auth cookie to requests
  webSession.webRequest.onBeforeSendHeaders(async (details, callback) => {
    if (cachedShipUrl && details.url.startsWith(cachedShipUrl)) {
      const headers = details.requestHeaders;
      if (headers) {
        // Get the auth cookie from storage
        store.get('encryptedAuthCookie').then((encryptedAuthCookie) => {
          if (encryptedAuthCookie) {
            const authCookie = decrypt(encryptedAuthCookie);
            headers.Cookie = authCookie;
          }
          callback({ requestHeaders: headers });
        });
      } else {
        callback({ requestHeaders: details.requestHeaders });
      }
    } else {
      callback({ requestHeaders: details.requestHeaders });
    }
  });

  // Configure session for CORS handling
  // Disabled for now, see above note about disabling webSecurity
  // webSession.webRequest.onHeadersReceived((details, callback) => {
  //   // Only modify headers for responses from the configured ship
  //   if (cachedShipUrl && details.url.startsWith(cachedShipUrl)) {
  //     console.log('Setting CORS headers for response from', cachedShipUrl);

  //     if (details.method === 'OPTIONS') {
  //       console.log(
  //         'Setting CORS headers for OPTIONS request',
  //         JSON.stringify(details)
  //       );
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
  //         statusLine: 'HTTP/1.1 200 OK',
  //       });
  //     } else {
  //       console.log('Setting CORS headers for non-OPTIONS request');
  //       callback({
  //         responseHeaders: {
  //           ...details.responseHeaders,
  //           'Access-Control-Allow-Origin': ['*'],
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
  if (!app.isPackaged) {
    // In development, load from the dev server
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built app
    // Properly resolve path to the web app dist directory
    const webAppPath = path.join(
      app.getAppPath(),
      'tlon-web-new',
      'dist',
      'index.html'
    );
    const resourcesPath = path.join(
      path.dirname(app.getAppPath()),
      'tlon-web-new',
      'dist',
      'index.html'
    );

    console.log('Trying to load web app from path:', webAppPath);
    console.log('App path:', app.getAppPath());

    if (fs.existsSync(webAppPath)) {
      console.log('Loading web app from app path');
      mainWindow.loadFile(webAppPath);
    } else if (fs.existsSync(resourcesPath)) {
      console.log('Loading web app from resources path');
      mainWindow.loadFile(resourcesPath);
    } else {
      console.error('Web app files not found at expected paths!');
      console.error('App path:', app.getAppPath());
      console.error('Web app path:', webAppPath);
      console.error('Resources path:', resourcesPath);
    }
  }

  // Handle external links - open them in the default browser instead of a new electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Check if the URL is external (not the cachedShipUrl)
    if (cachedShipUrl && !url.startsWith(cachedShipUrl)) {
      // Open the URL in the user's default browser
      shell.openExternal(url);
      return { action: 'deny' };
    }
    // Allow creating new windows for internal URLs, including links to apps running on the current ship (if we provide app launching from our app later)
    return { action: 'allow' };
  });

  // Handle direct navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only handle external URLs (not the app URL or cachedShipUrl)
    if (
      cachedShipUrl &&
      !url.startsWith(cachedShipUrl) &&
      !url.startsWith('http://localhost:3000') &&
      !url.startsWith('file://')
    ) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  ENCRYPTION_KEY = await getEncryptionKey();
  console.log('Encryption key initialized');

  try {
    cachedShipUrl = await store.get('shipUrl');
    console.log('Cached ship URL initialized:', cachedShipUrl);
  } catch (e) {
    console.error('Failed to initialize cached ship URL:', e);
  }

  setupSQLiteIPC();
  console.log('SQLite IPC handlers initialized');

  try {
    const storeHealth = await store.checkStore();
    console.log('Store health on startup:', storeHealth);
  } catch (e) {
    console.error('Failed to check store health:', e);
  }

  createWindow();
});

app.on('will-quit', async (event) => {
  try {
    const storeHealth = await store.checkStore();
    console.log('Store health before quit:', storeHealth);
  } catch (e) {
    console.error('Error during quit preparation:', e);
  }
});

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
  // Update both stored and cached values
  await store.set('shipUrl', shipUrl);
  cachedShipUrl = shipUrl;
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

// Handle auth persistence
ipcMain.handle(
  'store-auth-info',
  async (_event, { ship, shipUrl, authCookie }: AuthInfo) => {
    console.log('Storing auth info for ship:', ship);
    try {
      const shipUrlSet = await store.set('shipUrl', shipUrl);
      const shipSet = await store.set('ship', ship);

      cachedShipUrl = shipUrl;

      const encryptedAuthCookie = encrypt(authCookie);
      const cookieSet = await store.set(
        'encryptedAuthCookie',
        encryptedAuthCookie
      );

      if (!shipUrlSet || !shipSet || !cookieSet) {
        console.error('One or more auth values failed to persist properly');
        return false;
      }

      const storeHealth = await store.checkStore();
      console.log('Store health after setting auth info:', storeHealth);

      if (
        !storeHealth.hasShipUrl ||
        !storeHealth.hasShip ||
        !storeHealth.hasEncryptedCookie
      ) {
        console.error(
          'Auth data verification failed - one or more values missing after storage'
        );
        return false;
      }

      console.log('Successfully stored and verified auth info');
      return true;
    } catch (error) {
      console.error('Error storing auth info:', error);
      return false;
    }
  }
);

ipcMain.handle('get-auth-info', async () => {
  try {
    const shipUrl = await store.get('shipUrl');
    const ship = await store.get('ship');
    const encryptedAuthCookie = await store.get('encryptedAuthCookie');

    if (shipUrl) {
      cachedShipUrl = shipUrl;
    }

    if (!shipUrl || !ship || !encryptedAuthCookie) {
      console.log('Missing auth info components:', {
        hasShipUrl: !!shipUrl,
        hasShip: !!ship,
        hasEncryptedCookie: !!encryptedAuthCookie,
      });
      return null;
    }

    try {
      const authCookie = decrypt(encryptedAuthCookie);
      console.log('Successfully decrypted auth cookie', authCookie);
      // Validate that the cookie looks right
      if (authCookie && authCookie.includes('=')) {
        return { ship, shipUrl, authCookie };
      } else {
        console.error('Auth cookie decryption produced invalid result');
        return null;
      }
    } catch (decryptError) {
      console.error('Error decrypting auth cookie:', decryptError);
      console.error('This may indicate the encryption key has changed');
      return null;
    }
  } catch (error) {
    console.error('Error retrieving auth info with diagnostics:', error);
    console.error('Current user data path:', app.getPath('userData'));
    return null;
  }
});

ipcMain.handle('clear-auth-info', async () => {
  try {
    await store.delete('shipUrl');
    await store.delete('ship');
    await store.delete('encryptedAuthCookie');

    cachedShipUrl = null;

    return true;
  } catch (error) {
    console.error('Error clearing auth info:', error);
    return false;
  }
});
