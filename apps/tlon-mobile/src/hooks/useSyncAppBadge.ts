import { UrbitModuleSpec } from '@tloncorp/app/utils/urbitModule';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

const UrbitModule = NativeModules.UrbitModule as UrbitModuleSpec;

const logger = createDevLogger('useSyncAppBadge', false);

export function useSyncAppBadge() {
  useEffect(() => {
    db.observeWrites<db.BaseUnread>(db.ObservableField.BaseUnread, (unread) => {
      if (Platform.OS === 'ios' && unread.notifTimestamp) {
        try {
          UrbitModule.updateBadgeCount(
            unread.notifyCount ?? 0,
            unread.notifTimestamp
          );
        } catch (e) {
          logger.trackError('Failed to sync OS badge count', {
            error: e.toString(),
            errorStack: e.stack,
            count: unread.notifyCount,
            updatedAt: unread.updatedAt,
          });
        }
      }
    });
  }, []);
}
