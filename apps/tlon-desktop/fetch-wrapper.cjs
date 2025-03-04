// This is a CommonJS wrapper around cross-fetch

let fetchFunction = null;

async function getFetch() {
  if (fetchFunction === null) {
    try {
      const { default: crossFetch } = await import('cross-fetch');
      fetchFunction = crossFetch;
    } catch (err) {
      console.error('Failed to load cross-fetch:', err);
      // Fallback to global fetch if available
      fetchFunction = typeof globalThis.fetch === 'function' 
        ? globalThis.fetch.bind(globalThis) 
        : () => Promise.reject(new Error('No fetch implementation available'));
    }
  }
  return fetchFunction;
}

module.exports = getFetch;
