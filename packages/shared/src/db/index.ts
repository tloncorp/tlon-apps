import { configureHostingSessionStore } from '@tloncorp/api/api/hostingApi';

import {
  hostingAuthToken,
  hostingBotEnabled,
  hostingUserId,
} from './keyValue';

configureHostingSessionStore({
  authToken: hostingAuthToken,
  userId: hostingUserId,
  botEnabled: hostingBotEnabled,
});

export * as schema from './schema';
export * from './queries';
export * from './types';
export * from './fallback';
export * from './modelBuilders';
export * from './keyValue';
export * from './storageItem';
export * as storage from './keyValue';
export { setClient } from './client';
export type { AnySqliteDatabase } from './client';
export * from './changeListener';
export * from './writeObservers';
