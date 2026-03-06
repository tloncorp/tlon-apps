import { configureHostingSessionPersistence } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';

let isConfigured = false;

export function configureAppHostingSessionPersistence() {
  if (isConfigured) {
    return;
  }

  configureHostingSessionPersistence({
    getCookie: () => db.hostingAuthToken.getValue(),
    getUserId: () => db.hostingUserId.getValue(),
    setCookie: (cookie: string) => db.hostingAuthToken.setValue(cookie),
    setUserId: (userId: string) => db.hostingUserId.setValue(userId),
    setBotEnabled: (enabled: boolean) => db.hostingBotEnabled.setValue(enabled),
  });

  isConfigured = true;
}
