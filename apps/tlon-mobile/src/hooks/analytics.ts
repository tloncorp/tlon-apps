import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { AnalyticsEvent, createDevLogger, deleteGroup } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect } from 'react';

import { checkLatestVersion } from '../lib/lifecycleEvents';

const logger = createDevLogger('analytics hooks', true);

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
      logger.trackEvent(AnalyticsEvent.AnalyticsDigest, {
        ...digest,
        $set: {
          ...digest,
          analyticsDigestUpdatedAt: Date.now(),
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
