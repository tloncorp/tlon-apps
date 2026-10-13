/* eslint-env serviceworker, browser */

/* global workbox */

/* eslint no-underscore-dangle: off */
import {
  addPlugins,
  cleanupOutdatedCaches,
  precacheAndRoute,
} from 'workbox-precaching';

import { isCacheablePrecacheResponse } from './swWasmGuard';

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

addPlugins([
  {
    cacheWillUpdate: async ({ request, response }) =>
      (await isCacheablePrecacheResponse(request, response)) ? response : null,
  },
]);
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
