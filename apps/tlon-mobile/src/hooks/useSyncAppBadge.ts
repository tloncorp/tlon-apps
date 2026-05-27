import { UrbitModuleSpec } from '@tloncorp/app/utils/urbitModule';
import { createDevLogger } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useEffect } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

const UrbitModule = TurboModuleRegistry.get('UrbitModule') as UrbitModuleSpec;

const logger = createDevLogger('useSyncAppBadge', false);

export function useSyncAppBadge() {
  const { data: baseUnread } = store.useBaseUnread();
  const { data: notifyingUnreadSourceCount } =
    store.useNotifyingUnreadSourceCount();

  useEffect(() => {
    if (Platform.OS !== 'ios' || !baseUnread?.notifTimestamp) {
      return;
    }

    const baseCount = baseUnread.notifyCount ?? 0;
    // Nonzero badge counts stay backend-driven. Local unread state is only
    // used to clear a stale badge after the last notifying source is read.
    const count = notifyingUnreadSourceCount === 0 ? 0 : baseCount;

    try {
      UrbitModule.updateBadgeCount(count, baseUnread.notifTimestamp);
    } catch (e) {
      logger.trackError('Failed to sync OS badge count', {
        error: e.toString(),
        errorStack: e.stack,
        count,
        updatedAt: baseUnread.updatedAt,
      });
    }
  }, [
    baseUnread?.notifTimestamp,
    baseUnread?.notifyCount,
    baseUnread?.updatedAt,
    notifyingUnreadSourceCount,
  ]);
}
