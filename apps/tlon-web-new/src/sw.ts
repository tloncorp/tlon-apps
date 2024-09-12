/* eslint-env serviceworker, browser */

/* global workbox */

/* eslint no-underscore-dangle: off */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
