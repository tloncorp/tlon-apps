// This is a CommonJS wrapper around electron-store

let storeInstance = null;
let initPromise = null;
let isInitializing = false;

// Get app info for proper store naming/location
const getAppInfo = async () => {
  try {
    const { app } = await import('electron');
    return {
      appName: app.name || 'tlon-desktop',
      isPackaged: app.isPackaged,
      userDataPath: app.getPath('userData'),
    };
  } catch (e) {
    console.error('Failed to get app info:', e);
    return {
      appName: 'tlon-desktop',
      isPackaged: false,
      userDataPath: null,
    };
  }
};

async function initStore() {
  if (isInitializing) {
    return initPromise;
  }

  if (storeInstance) {
    return storeInstance;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const { default: Store } = await import('electron-store');
      const { isPackaged } = await getAppInfo();

      const storeName = isPackaged ? 'tlon-auth-data' : 'tlon-auth-data-dev';

      console.log(`Initializing electron-store with name: ${storeName}`);

      storeInstance = new Store({
        name: storeName,
        clearInvalidConfig: true, // Clear if the config becomes corrupted
        defaults: {
          shipUrl: '',
          ship: '',
          encryptedAuthCookie: '',
          encryptionKey: '',
        },
      });

      console.log(`Store location: ${storeInstance.path}`);

      const allData = storeInstance.store;
      console.log('Store contents on init:', {
        hasShipUrl: !!allData.shipUrl,
        hasShip: !!allData.ship,
        hasEncryptedCookie: !!allData.encryptedAuthCookie,
        hasEncryptionKey: !!allData.encryptionKey,
      });

      return storeInstance;
    } catch (error) {
      console.error('Failed to initialize electron-store:', error);
      // We won't throw, to avoid breaking the app, but we will return null
      // so the app can handle missing store
      return null;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

module.exports = {
  async get(key) {
    try {
      const store = await initStore();
      if (!store) return null;
      const value = store.get(key);
      if (key === 'encryptionKey' || key === 'encryptedAuthCookie') {
        console.log(
          `Reading ${key} from store: ${value ? 'exists' : 'missing'}`
        );
      } else {
        console.log(`Reading ${key} from store:`, value);
      }
      return value;
    } catch (error) {
      console.error(`Error getting ${key} from store:`, error);
      return null;
    }
  },

  async set(key, value) {
    try {
      const store = await initStore();
      if (!store) {
        console.error(`Cannot set ${key}: store initialization failed`);
        return false;
      }

      if (key === 'encryptionKey' || key === 'encryptedAuthCookie') {
        console.log(`Setting ${key} in store`);
      } else {
        console.log(`Setting ${key} in store:`, value);
      }

      store.set(key, value);

      const verifyValue = store.get(key);
      const writeSuccessful =
        (typeof value === 'string' && verifyValue === value) ||
        (typeof value === 'object' &&
          JSON.stringify(verifyValue) === JSON.stringify(value));

      if (!writeSuccessful) {
        console.error(`Failed to verify write of ${key} to store`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error setting ${key} in store:`, error);
      return false;
    }
  },

  async delete(key) {
    try {
      const store = await initStore();
      if (!store) return false;
      console.log(`Deleting ${key} from store`);
      store.delete(key);
      return true;
    } catch (error) {
      console.error(`Error deleting ${key} from store:`, error);
      return false;
    }
  },

  async clear() {
    try {
      const store = await initStore();
      if (!store) return false;
      console.log('Clearing store');
      store.clear();
      return true;
    } catch (error) {
      console.error('Error clearing store:', error);
      return false;
    }
  },

  async checkStore() {
    try {
      const store = await initStore();
      if (!store)
        return { healthy: false, message: 'Store initialization failed' };

      const path = store.path;
      const allData = store.store;

      return {
        healthy: true,
        path,
        hasShipUrl: !!allData.shipUrl,
        hasShip: !!allData.ship,
        hasEncryptedCookie: !!allData.encryptedAuthCookie,
        hasEncryptionKey: !!allData.encryptionKey,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message,
      };
    }
  },
};
