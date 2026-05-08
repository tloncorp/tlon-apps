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

let recoveryPromise: Promise<boolean> | null = null;

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

async function setAndConfirmBaseVolumeLevel(level: NotificationLevel) {
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

async function markNotificationRestorePending(desiredLevel: NotificationLevel) {
  await db.tlonbotRevivalNotificationRestore.setValue((current) => ({
    ...current,
    pending: true,
    desiredLevel,
    createdAt: current.createdAt ?? Date.now(),
    lastErrorAt: undefined,
    lastErrorMessage: undefined,
  }));
}

async function temporarilyMuteNodeNotifications(
  restoreLevel: NotificationLevel
) {
  await markNotificationRestorePending(restoreLevel);

  await withRetry(
    () =>
      setAndConfirmBaseVolumeLevel(TEMPORARY_PROVISIONING_NOTIFICATION_LEVEL),
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
  const pendingRestore = await db.tlonbotRevivalNotificationRestore
    .getValue(true)
    .catch(() => null);
  if (pendingRestore?.desiredLevel) {
    return pendingRestore.desiredLevel;
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

export function getTlonbotRevivalRestoreNotificationLevel(
  setup: Pick<db.TlonbotRevivalSetup, 'notificationLevel'>
): NotificationLevel {
  return setup.notificationLevel ?? DEFAULT_RESTORE_NOTIFICATION_LEVEL;
}

export async function restoreTlonbotRevivalNotificationLevel(
  restoreLevel: NotificationLevel,
  source: string
): Promise<boolean> {
  await db.tlonbotRevivalNotificationRestore.setValue((current) => ({
    ...current,
    pending: true,
    desiredLevel: restoreLevel,
    lastAttemptAt: Date.now(),
  }));

  try {
    await withRetry(() => setAndConfirmBaseVolumeLevel(restoreLevel), {
      startingDelay: 1000,
      numOfAttempts: 4,
      maxDelay: 4000,
    });

    await db.tlonbotRevivalNotificationRestore.resetValue();
    logger.trackEvent('Tlonbot revival notifications restored', {
      restoreNotificationLevel: restoreLevel,
      source,
    });
    return true;
  } catch (error) {
    await db.tlonbotRevivalNotificationRestore.setValue((current) => ({
      ...current,
      pending: true,
      desiredLevel: restoreLevel,
      lastErrorAt: Date.now(),
      lastErrorMessage: error instanceof Error ? error.message : String(error),
    }));
    logger.trackError('TlonBot revival notification level restore failed', {
      error,
      restoreNotificationLevel: restoreLevel,
      source,
    });
    return false;
  }
}

export async function recoverTlonbotRevivalNotificationLevel(
  source: string
): Promise<boolean> {
  if (recoveryPromise) {
    return recoveryPromise;
  }

  recoveryPromise = (async () => {
    const pendingRestore =
      await db.tlonbotRevivalNotificationRestore.getValue(true);

    if (!pendingRestore.pending || !pendingRestore.desiredLevel) {
      return false;
    }

    return restoreTlonbotRevivalNotificationLevel(
      pendingRestore.desiredLevel,
      source
    );
  })().finally(() => {
    recoveryPromise = null;
  });

  return recoveryPromise;
}
