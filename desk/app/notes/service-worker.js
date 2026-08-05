self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());
self.addEventListener("fetch", (e) => {
  // No caching: defer offline support to a later pass. We still need
  // a fetch handler for the install prompt to be eligible.
});
