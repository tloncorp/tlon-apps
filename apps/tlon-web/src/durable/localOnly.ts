// Origins besides this page's that durable mode may reach: the servers of
// self-hosted accounts the user signed in to.
const allowedOrigins = new Set<string>();

export function allowDurableOrigin(server: string) {
  allowedOrigins.add(new URL(server).origin);
}

function isAllowed(url: URL) {
  return url.origin === location.origin || allowedOrigins.has(url.origin);
}

if (import.meta.env.MODE === 'durable') {
  (
    globalThis as typeof globalThis & { tlonLocalOnly?: boolean }
  ).tlonLocalOnly = true;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, options) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.href
    );
    if (!isAllowed(url) && !['blob:', 'data:'].includes(url.protocol)) {
      return Promise.reject(
        new Error('External requests are disabled in local durable mode')
      );
    }
    return originalFetch(input, options);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...args: unknown[]
  ) {
    if (!isAllowed(new URL(url, location.href)))
      throw new Error('External requests are disabled in local durable mode');
    return (originalOpen as Function).call(this, method, url, ...args);
  };
  navigator.sendBeacon = () => false;
}
