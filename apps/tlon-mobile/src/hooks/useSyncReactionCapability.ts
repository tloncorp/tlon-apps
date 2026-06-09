import { UrbitModuleSpec } from '@tloncorp/app/utils/urbitModule';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { backendVersionSupportsReactions } from '@tloncorp/shared/logic';
import { useEffect } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

const UrbitModule =
  Platform.OS !== 'web'
    ? (TurboModuleRegistry.get('UrbitModule') as UrbitModuleSpec | null)
    : null;

const logger = createDevLogger('useSyncReactionCapability', false);

// Mirrors the backend's reaction capability (derived from its groups version)
// into native storage so the notification extension can pick the v9 vs v8
// activity-event mark without scrying a version itself.
export function useSyncReactionCapability() {
  const appInfo = db.appInfo.useValue();
  const groupsVersion = appInfo?.groupsVersion;

  useEffect(() => {
    if (!UrbitModule || !groupsVersion) {
      return;
    }
    const supported = backendVersionSupportsReactions(groupsVersion);
    try {
      UrbitModule.setActivitySupportsReactions(supported);
    } catch (e) {
      logger.trackError('Failed to sync activity reaction capability', {
        error: e instanceof Error ? e.message : String(e),
        groupsVersion,
      });
    }
  }, [groupsVersion]);
}
