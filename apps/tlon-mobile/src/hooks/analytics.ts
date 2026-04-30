import * as api from '@tloncorp/api';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { checkLatestVersion } from '../lib/lifecycleEvents';

const logger = createDevLogger('analytics hooks', true);
const HOME_GROUP_SLUG = 'home-group';

export function useCheckAppInstalled() {
  const lureMeta = useLureMetadata();
  useEffect(() => {
    async function checkNewlyInstalled() {
      const { status } = await checkLatestVersion();
      if (status === 'installed') {
        logger.trackEvent(AnalyticsEvent.AppInstalled, {
          hadInitialInvite: lureMeta !== null,
        });
      }
    }
    checkNewlyInstalled();
  }, []);
}

export function useCheckAppUpdated() {
  useEffect(() => {
    async function checkNewlyInstalled() {
      const { status, version } = await checkLatestVersion();
      if (status === 'updated') {
        logger.trackEvent(AnalyticsEvent.AppUpdated, {
          latestVersion: version,
        });
      }
    }
    checkNewlyInstalled();
  }, []);
}

export async function checkAnalyticsDigest() {
  const currentUserId = api.getCurrentUserId();
  const { status } = await Contacts.getPermissionsAsync();
  const isHosted = api.getCurrentUserIsHosted();
  const { status: pushNotificationStatus, canAskAgain } =
    await Notifications.getPermissionsAsync();

  const userHasCompletedFirstSync =
    await db.userHasCompletedFirstSync.getValue();
  const analyticsDigestUpdatedAt = await db.anyalticsDigestUpdatedAt.getValue();
  const oneDayAgo = Date.now() - 1000 * 60 * 60 * 24;
  if (
    userHasCompletedFirstSync &&
    (analyticsDigestUpdatedAt ?? 0) < oneDayAgo
  ) {
    try {
      const digest = await db.getAnalyticsDigest();
      const homeGroup = await db.getGroup({
        id: `${currentUserId}/${HOME_GROUP_SLUG}`,
      });
      const homeGroupMemberCount =
        homeGroup?.memberCount ?? homeGroup?.members?.length ?? null;

      logger.trackEvent(AnalyticsEvent.AnalyticsDigest, {
        ...digest,
        homeGroupMemberCount,
        $set: {
          ...digest,
          homeGroupMemberCount,
          analyticsDigestUpdatedAt: Date.now(),
          userId: currentUserId || undefined,
          contactBookPermissionGranted: status === 'granted',
          pushNotificationPermissionGranted:
            pushNotificationStatus === 'granted',
          pushNotificationCanAskAgain: canAskAgain,
          isHosted,
        },
      });
      await db.anyalticsDigestUpdatedAt.setValue(Date.now());
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorDigestFailed, {
        error: e,
      });
    }
  }
}
