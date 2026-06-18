import * as api from '@tloncorp/api';
import type { NotificationLevel } from '@tloncorp/api/urbit';
import * as ub from '@tloncorp/api/urbit';
import { createDevLogger, withRetry } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { setBaseVolumeLevel } from '@tloncorp/shared/store';

import { connectNotifyProvider } from './notificationsApi';

const logger = createDevLogger('tlonbotRevivalNotifications', true);
const TEMPORARY_PROVISIONING_NOTIFICATION_LEVEL: NotificationLevel = 'hush';
const DEFAULT_RESTORE_NOTIFICATION_LEVEL: NotificationLevel = 'medium';

function normalizeBaseVolumeLevel(level: NotificationLevel): NotificationLevel {
  return level === 'default' ? 'medium' : level;
}

async function getRemoteBaseVolumeLevel(): Promise<NotificationLevel | null> {
  const remoteVolumeSettings = await api.getVolumeSettings();
  const remoteBaseVolume = remoteVolumeSettings.base;
  return remoteBaseVolume
    ? normalizeBaseVolumeLevel(ub.getLevelFromVolumeMap(remoteBaseVolume))
    : null;
}

export async function setAndConfirmTlonbotRevivalNotificationLevel(
  level: NotificationLevel
) {
  await setBaseVolumeLevel({ level });

  const expectedLevel = normalizeBaseVolumeLevel(level);
  const remoteLevel = await getRemoteBaseVolumeLevel();
  if (remoteLevel !== expectedLevel) {
    throw new Error(
      `Expected remote base volume ${expectedLevel}, found ${
        remoteLevel ?? 'none'
      }`
    );
  }
}

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

async function stageNotificationRestore(desiredLevel: NotificationLevel) {
  await db.tlonbotRevivalDeferredConfig.setValue((current) => ({
    ...current,
    notificationLevel: desiredLevel,
  }));
}

async function temporarilyMuteNodeNotifications(
  restoreLevel: NotificationLevel
) {
  await stageNotificationRestore(restoreLevel);

  await withRetry(
    () =>
      setAndConfirmTlonbotRevivalNotificationLevel(
        TEMPORARY_PROVISIONING_NOTIFICATION_LEVEL
      ),
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
  notificationToken?: string,
  restoreLevel?: NotificationLevel
) {
  const desiredRestoreLevel =
    restoreLevel ?? (await getFallbackRestoreNotificationLevel());

  await Promise.all([
    registerNotificationToken(notificationToken),
    temporarilyMuteNodeNotifications(desiredRestoreLevel),
  ]);
  logger.trackEvent('Tlonbot pre-provisioning notifications configured');
}

async function getFallbackRestoreNotificationLevel(): Promise<NotificationLevel> {
  const pendingConfig = await db.tlonbotRevivalDeferredConfig
    .getValue(true)
    .catch(() => null);
  if (pendingConfig?.notificationLevel) {
    return pendingConfig.notificationLevel;
  }

  return DEFAULT_RESTORE_NOTIFICATION_LEVEL;
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

  await prepareTlonbotRevivalNotifications(
    setup.notificationToken,
    restoreLevel
  );
}
