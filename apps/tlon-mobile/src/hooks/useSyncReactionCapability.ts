import { UrbitModuleSpec } from '@tloncorp/app/utils/urbitModule';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { isVersionBelow } from '@tloncorp/shared/logic';
import { useEffect } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

// The first deployed %groups release that ships reaction support (the v9
// activity-event-1 notification mark + react emission). The reactions code is
// on develop but unreleased; the latest deployed version is 11.2.2, so this is
// the next release. Below it the flag stays off and the extension falls back to
// the v8 activity-event mark (v9 would 404 every notification on old backends).
// TODO(reactions): confirm this matches the release that actually deploys reactions.
const REACTIONS_MIN_GROUPS_VERSION = '11.3.0';

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
    // Only enable when we can affirmatively confirm a high-enough version;
    // anything unparseable (e.g. 'n/a' when the scry failed) stays off so an
    // old backend never gets v9 fetches that would 404 every notification.
    const looksLikeSemver = /^\d+\.\d+\.\d+/.test(groupsVersion);
    const supported =
      looksLikeSemver &&
      !isVersionBelow(groupsVersion, REACTIONS_MIN_GROUPS_VERSION);

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
