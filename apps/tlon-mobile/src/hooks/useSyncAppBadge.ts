import { UrbitModuleSpec } from '@tloncorp/app/utils/urbitModule';
import { createDevLogger } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useEffect } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

const UrbitModule = TurboModuleRegistry.get('UrbitModule') as UrbitModuleSpec;

const logger = createDevLogger('useSyncAppBadge', false);

export function useSyncAppBadge() {
  const { data: baseUnread } = store.useBaseUnread();
  const { data: notifyingUnreadChannelCount } =
    store.useUnreadsCountWithoutMuted();

  useEffect(() => {
    if (Platform.OS !== 'ios' || !baseUnread?.notifTimestamp) {
      return;
    }

    const baseCount = baseUnread.notifyCount ?? 0;
    // Nonzero badge counts stay backend-driven. Local channel unread state is
    // only used to clear a stale badge after the last notifying channel is read.
    const count = notifyingUnreadChannelCount === 0 ? 0 : baseCount;

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
    notifyingUnreadChannelCount,
  ]);
}
