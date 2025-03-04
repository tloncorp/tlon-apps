// This is a CommonJS wrapper around electron-store
const { app } = require('electron');

let storeInstance = null;

async function initStore() {
  if (!storeInstance) {
    // Dynamically import electron-store (ESM)
    const { default: Store } = await import('electron-store');
    storeInstance = new Store({
      defaults: {
        shipUrl: '',
      }
    });
  }
  return storeInstance;
}

// Expose a promise-based API
module.exports = {
  async get(key) {
    const store = await initStore();
    return store.get(key);
  },
  async set(key, value) {
    const store = await initStore();
    store.set(key, value);
  },
  async delete(key) {
    const store = await initStore();
    store.delete(key);
  },
  async clear() {
    const store = await initStore();
    store.clear();
  }
};
