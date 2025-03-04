// This is a CommonJS wrapper around electron-is-dev

let isDevValue = null;

async function checkIsDev() {
  if (isDevValue === null) {
    try {
      const { default: isDev } = await import('electron-is-dev');
      isDevValue = isDev;
    } catch (err) {
      console.error('Failed to load electron-is-dev:', err);
      isDevValue = false; // Default to production
    }
  }
  return isDevValue;
}

module.exports = checkIsDev;
