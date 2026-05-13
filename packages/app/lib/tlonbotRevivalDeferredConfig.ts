import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Attachment } from '@tloncorp/shared/domain';
import { withRetry } from '@tloncorp/shared/logic';
import {
  getSession,
  subscribeToSession,
  updateCurrentUserProfile,
  uploadAsset,
  waitForUploads,
} from '@tloncorp/shared/store';

import { connectNotifyProvider } from './notificationsApi';
import { setAndConfirmTlonbotRevivalNotificationLevel } from './tlonbotRevivalNotifications';

const logger = createDevLogger('tlonbotRevivalDeferredConfig', false);

const BASIC_PROVIDER_ID = 'basic';
const RECOVERY_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];
const RECOVERY_RETRY_CONFIG = {
  startingDelay: 1000,
  numOfAttempts: 6,
  maxDelay: 15_000,
};

type DeferredAction =
  | 'profileNickname'
  | 'notificationToken'
  | 'notificationLevel'
  | 'botNickname'
  | 'botAvatar'
  | 'botModel';

type DeferredField = keyof db.TlonbotRevivalDeferredConfig;

let recoveryPromise: Promise<boolean> | null = null;
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let connectionUnsubscribe: (() => void) | null = null;
let recoveryRetryIndex = 0;

function hasBotModelConfig(config: db.TlonbotRevivalDeferredConfig) {
  return !!(
    config.botProvider &&
    config.botProvider !== BASIC_PROVIDER_ID &&
    config.botModel
  );
}

function hasPendingConfig(config: db.TlonbotRevivalDeferredConfig) {
  return !!(
    config.profileNickname ||
    config.notificationToken ||
    config.notificationLevel ||
    config.botName ||
    config.botAvatarUploadIntent ||
    config.botAvatarUrl ||
    hasBotModelConfig(config)
  );
}

function requireString(value: string | null | undefined, message: string) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function hasActiveConnection() {
  const status = getSession()?.channelStatus;
  return status === 'active' || status === 'reconnected';
}

function runScheduledRecovery(source: string) {
  recoverTlonbotRevivalDeferredConfig(source).catch((error) => {
    logger.trackError('TlonBot revival deferred config recovery failed', {
      error,
      source,
    });
  });
}

function nextRecoveryRetryDelay() {
  const delay =
    RECOVERY_RETRY_DELAYS_MS[
      Math.min(recoveryRetryIndex, RECOVERY_RETRY_DELAYS_MS.length - 1)
    ];
  recoveryRetryIndex += 1;
  return delay;
}

function resetRecoveryRetryDelay() {
  recoveryRetryIndex = 0;
}

function clearRecoverySchedule() {
  if (recoveryTimer) {
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }

  if (connectionUnsubscribe) {
    connectionUnsubscribe();
    connectionUnsubscribe = null;
  }
}

function scheduleTimedRecovery() {
  if (recoveryTimer) {
    return;
  }

  const delay = nextRecoveryRetryDelay();
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    runScheduledRecovery('scheduled_retry');
  }, delay);
}

function scheduleConnectionRecovery() {
  if (connectionUnsubscribe) {
    return;
  }

  connectionUnsubscribe = subscribeToSession((session) => {
    const connected =
      session?.channelStatus === 'active' ||
      session?.channelStatus === 'reconnected';
    if (!connected) {
      return;
    }

    connectionUnsubscribe?.();
    connectionUnsubscribe = null;
    runScheduledRecovery('connection_active');
  });
}

function scheduleRecovery() {
  scheduleTimedRecovery();
  scheduleConnectionRecovery();
}

async function clearDeferredFields(fields: DeferredField[]) {
  await db.tlonbotRevivalDeferredConfig.setValue((current) => {
    const next = { ...current };
    for (const field of fields) {
      delete next[field];
    }
    return next;
  });
}

function isRemoteAvatarUrl(url: string) {
  return /^(?!file|data).+/.test(url);
}

function hasUnrecoverableBotAvatar(config: db.TlonbotRevivalDeferredConfig) {
  return !!(
    config.botAvatarUrl &&
    !config.botAvatarUploadIntent &&
    !isRemoteAvatarUrl(config.botAvatarUrl)
  );
}

async function resolveDeferredBotAvatarUrl(
  config: db.TlonbotRevivalDeferredConfig
) {
  if (config.botAvatarUploadIntent) {
    const uploadIntent = config.botAvatarUploadIntent;
    const uploadKey = Attachment.UploadIntent.extractKey(uploadIntent);
    await uploadAsset(uploadIntent);
    const uploadStates = await waitForUploads([uploadKey]);
    const uploadState = uploadStates[uploadKey];

    if (uploadState?.status !== 'success') {
      throw new Error('Deferred avatar upload did not finish successfully');
    }

    return uploadState.remoteUri;
  }

  if (config.botAvatarUrl && isRemoteAvatarUrl(config.botAvatarUrl)) {
    return config.botAvatarUrl;
  }

  throw new Error('Deferred bot avatar is not uploadable');
}

async function runAction(
  action: DeferredAction,
  source: string,
  fields: DeferredField[],
  fn: () => Promise<void>
) {
  try {
    await withRetry(fn, RECOVERY_RETRY_CONFIG);
    await clearDeferredFields(fields);
    logger.trackEvent('TlonBot revival deferred config action succeeded', {
      action,
      source,
    });
  } catch (error) {
    logger.trackError('TlonBot revival deferred config action failed', {
      action,
      error,
      source,
    });
  }
}

export async function stageTlonbotRevivalDeferredConfig(
  setup: db.TlonbotRevivalSetup
) {
  const shouldSetBotModel = !!(
    setup.botProvider &&
    setup.botProvider !== BASIC_PROVIDER_ID &&
    setup.botModel
  );

  await db.tlonbotRevivalDeferredConfig.setValue((current) => ({
    ...current,
    profileNickname: setup.nickname,
    notificationToken: setup.notificationToken,
    notificationLevel: setup.notificationLevel ?? current.notificationLevel,
    botName: setup.botName,
    botAvatarUrl: setup.botAvatarUrl,
    botAvatarUploadIntent: setup.botAvatarUploadIntent,
    botProvider: shouldSetBotModel ? setup.botProvider : undefined,
    botModel: shouldSetBotModel ? setup.botModel : undefined,
  }));
  resetRecoveryRetryDelay();
}

export async function recoverTlonbotRevivalDeferredConfig(
  source: string
): Promise<boolean> {
  if (recoveryPromise) {
    return recoveryPromise;
  }
  clearRecoverySchedule();

  recoveryPromise = (async () => {
    const config = await db.tlonbotRevivalDeferredConfig.getValue(true);
    if (!hasPendingConfig(config)) {
      if (Object.keys(config).length > 0) {
        await db.tlonbotRevivalDeferredConfig.resetValue();
      }
      resetRecoveryRetryDelay();
      return false;
    }
    if (!hasActiveConnection()) {
      scheduleRecovery();
      return false;
    }

    const hostedShipId = await db.hostedUserNodeId.getValue().catch(() => '');
    const shipId = hostedShipId ? desig(hostedShipId) : '';
    const userId = await db.hostingUserId.getValue().catch(() => '');

    if (config.notificationLevel) {
      await runAction('notificationLevel', source, ['notificationLevel'], () =>
        setAndConfirmTlonbotRevivalNotificationLevel(config.notificationLevel!)
      );
    }

    if (config.notificationToken) {
      await runAction('notificationToken', source, ['notificationToken'], () =>
        connectNotifyProvider(config.notificationToken!)
      );
    }

    if (config.profileNickname) {
      await runAction('profileNickname', source, ['profileNickname'], () =>
        updateCurrentUserProfile(
          { nickname: config.profileNickname! },
          { shouldThrow: true }
        )
      );
    }

    if (config.botName) {
      await runAction('botNickname', source, ['botName'], async () => {
        await api.setTlawnNickname(
          requireString(
            shipId,
            'Missing ship for deferred bot nickname update'
          ),
          config.botName!
        );
      });
    }

    if (hasUnrecoverableBotAvatar(config)) {
      logger.trackError('TlonBot revival bot avatar update skipped', {
        source,
        step: 'missing_upload_intent',
      });
      await clearDeferredFields(['botAvatarUrl', 'botAvatarUploadIntent']);
    } else if (config.botAvatarUploadIntent || config.botAvatarUrl) {
      await runAction(
        'botAvatar',
        source,
        ['botAvatarUrl', 'botAvatarUploadIntent'],
        async () => {
          await api.setTlawnAvatar(
            requireString(
              shipId,
              'Missing ship for deferred bot avatar update'
            ),
            await resolveDeferredBotAvatarUrl(config)
          );
        }
      );
    }

    if (hasBotModelConfig(config)) {
      await runAction(
        'botModel',
        source,
        ['botProvider', 'botModel'],
        async () => {
          await api.setTlawnPrimaryModel(
            requireString(
              userId,
              'Missing user ID for deferred bot model update'
            ),
            {
              provider: config.botProvider!,
              model: config.botModel!,
            }
          );

          const running = await api.awaitBotRunning(
            requireString(
              shipId,
              'Missing ship for deferred bot model readiness check'
            ),
            {
              timeoutMs: 30_000,
              pollIntervalMs: 1500,
            }
          );
          if (!running) {
            logger.trackError(
              'TlonBot revival model update readiness timed out',
              {
                provider: config.botProvider,
                model: config.botModel,
                source,
              }
            );
          }
        }
      );
    }

    const remaining = await db.tlonbotRevivalDeferredConfig.getValue(true);
    if (!hasPendingConfig(remaining)) {
      await db.tlonbotRevivalDeferredConfig.resetValue();
      resetRecoveryRetryDelay();
      logger.trackEvent('TlonBot revival deferred config completed', {
        source,
      });
      return true;
    }

    scheduleRecovery();
    return false;
  })().finally(() => {
    recoveryPromise = null;
  });

  return recoveryPromise;
}
