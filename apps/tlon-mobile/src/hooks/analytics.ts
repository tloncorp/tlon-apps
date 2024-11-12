import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { useEffect } from 'react';

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
