import { UrbitModuleSpec } from '@tloncorp/app/utils/urbitModule';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { formatUv, unixToDa } from '@urbit/aura';
import { useEffect } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

const UrbitModule = TurboModuleRegistry.get('UrbitModule') as UrbitModuleSpec;

const logger = createDevLogger('useSyncAppBadge', false);

export function useSyncAppBadge() {
  useEffect(() => {
    db.observeWrites<db.BaseUnread>(db.ObservableField.BaseUnread, (unread) => {
      console.log(`bl: write obsserver fired`, unread);
      try {
        const roundedUpUnix = Math.ceil(unread.updatedAt / 1000);
        const uid = formatUv(unixToDa(roundedUpUnix));
        console.log(`bl: calling updateBadgeCount with`, {
          count: unread.notifyCount ?? 0,
          uid,
        });
        UrbitModule.updateBadgeCount(unread.notifyCount ?? 0, uid);
      } catch (e) {
        logger.trackError('Failed to sync OS badge count', {
          error: e.toString(),
          errorStack: e.stack,
          count: unread.notifyCount,
          updatedAt: unread.updatedAt,
        });
      }
    });
  }, []);
}
