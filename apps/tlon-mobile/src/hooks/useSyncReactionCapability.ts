import { UrbitModuleSpec } from '@tloncorp/app/utils/urbitModule';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  activityVersionSupportsNotes,
  activityVersionSupportsReactions,
} from '@tloncorp/shared/logic';
import { useEffect } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

const UrbitModule =
  Platform.OS !== 'web'
    ? (TurboModuleRegistry.get('UrbitModule') as UrbitModuleSpec | null)
    : null;

const logger = createDevLogger('useSyncReactionCapability', false);

// Mirrors the backend's reaction/notes capabilities (derived from its groups
// version) into native storage so the notification extension can pick the
// right activity-event mark without scrying a version itself.
export function useSyncReactionCapability() {
  const appInfo = db.appInfo.useValue();
  const groupsVersion = appInfo?.groupsVersion;

  useEffect(() => {
    if (!UrbitModule || !groupsVersion) {
      return;
    }
    try {
      UrbitModule.setActivitySupportsReactions(
        activityVersionSupportsReactions(groupsVersion)
      );
      UrbitModule.setActivitySupportsNotes(
        activityVersionSupportsNotes(groupsVersion)
      );
    } catch (e) {
      logger.trackError('Failed to sync activity capability', {
        error: e instanceof Error ? e.message : String(e),
        groupsVersion,
      });
    }
  }, [groupsVersion]);
}
