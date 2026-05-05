import type { NotificationLevel } from '@tloncorp/api/urbit';
import { createDevLogger, withRetry } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { setBaseVolumeLevel } from '@tloncorp/shared/store';

import { connectNotifyProvider } from './notificationsApi';

const logger = createDevLogger('tlonbotRevivalNotifications', true);
const TEMPORARY_PROVISIONING_NOTIFICATION_LEVEL: NotificationLevel = 'hush';
const DEFAULT_RESTORE_NOTIFICATION_LEVEL: NotificationLevel = 'medium';

async function registerNotificationToken(notificationToken?: string) {
  if (!notificationToken) {
    return;
  }

  await withRetry(() => connectNotifyProvider(notificationToken), {
    startingDelay: 750,
    numOfAttempts: 4,
    maxDelay: 4000,
  }).catch((error) => {
    logger.trackError('TlonBot revival notification token update failed', {
      error,
      step: 'provisioning_prepare',
    });
  });
}

async function temporarilyMuteNodeNotifications() {
  await withRetry(
    () =>
      setBaseVolumeLevel({
        level: TEMPORARY_PROVISIONING_NOTIFICATION_LEVEL,
      }),
    {
      startingDelay: 750,
      numOfAttempts: 4,
      maxDelay: 4000,
    }
  ).catch((error) => {
    logger.trackError('TlonBot revival temporary notification mute failed', {
      error,
    });
  });
}

export async function prepareTlonbotRevivalNotifications(
  notificationToken?: string
) {
  await Promise.all([
    registerNotificationToken(notificationToken),
    temporarilyMuteNodeNotifications(),
  ]);
  logger.trackEvent('Tlonbot pre-provisioning notifications configured');
}

async function getFallbackRestoreNotificationLevel(): Promise<NotificationLevel> {
  const baseVolume = await db.getVolumeSetting('base').catch(() => null);
  return baseVolume?.level ?? DEFAULT_RESTORE_NOTIFICATION_LEVEL;
}

export async function prepareTlonbotRevivalNotificationsForProvisioning(
  setup: Pick<db.TlonbotRevivalSetup, 'notificationLevel' | 'notificationToken'>
) {
  const restoreLevel =
    setup.notificationLevel ?? (await getFallbackRestoreNotificationLevel());

  await db.tlonbotRevivalSetup.setValue((current) => ({
    ...current,
    notificationLevel: current.notificationLevel ?? restoreLevel,
  }));

  await prepareTlonbotRevivalNotifications(setup.notificationToken);
}

export function getTlonbotRevivalRestoreNotificationLevel(
  setup: Pick<db.TlonbotRevivalSetup, 'notificationLevel'>
): NotificationLevel {
  return setup.notificationLevel ?? DEFAULT_RESTORE_NOTIFICATION_LEVEL;
}
