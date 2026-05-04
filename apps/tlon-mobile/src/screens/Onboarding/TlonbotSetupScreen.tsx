import * as api from '@tloncorp/api';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import { connectNotifyProvider } from '@tloncorp/app/lib/notificationsApi';
import { ScreenHeader, TlonText, View, YStack } from '@tloncorp/app/ui';
import { Attachment, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { withRetry } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { prejoinTlonbotRevivalGroups } from '../../lib/tlonbotRevival';
import { FadingTextCarousel } from './FadingTextCarousel';
import { SegmentedSpinner } from './SegmentedSpinner';

const logger = createDevLogger('TlonbotSetupScreen', true);
const POLL_INTERVAL_MS = 5000;
const BASIC_PROVIDER_ID = 'basic';
const noop = () => {};

const SETUP_MESSAGES = [
  'This will take up to 5 minutes. Grab a coffee!',
  "We'll send you a notification when it's ready.",
  'Mention your bot with @ to use it in groups.',
  'You can set up recurring reminders with your bot.',
  'Use your bot to updates from your group chats.',
  'Your bot can process images and search the web.',
];

export function TlonbotSetupScreen() {
  const applyingRef = useRef(false);
  const provisioningKickoffStartedRef = useRef(false);
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = useCallback(async () => {
    logger.trackEvent('Logged out before Tlonbot setup completed');
    setLoggingOut(true);
    await handleLogout();
  }, [handleLogout]);

  const applyDeferredSetup = useCallback(async (shipId: string) => {
    if (applyingRef.current) {
      return;
    }

    applyingRef.current = true;

    try {
      const setup = await db.tlonbotRevivalSetup.getValue(true);

      if (!setup.applied) {
        await store.syncStart(true).catch((error) => {
          logger.trackError('TlonBot revival sync failed before setup apply', {
            error,
          });
        });

        await applyProfileAndNotificationPreferences(setup);
        await applyBotPreferences(shipId, setup);
        await db.tlonbotRevivalSetup.setValue((current) => ({
          ...current,
          applied: true,
        }));
      }

      await store.clearShipRevivalStatus();
      await db.tlonbotRevivalSetup.resetValue();
      await db.hostedAccountIsInitialized.setValue(true);
    } catch (error) {
      applyingRef.current = false;
      logger.trackError('TlonBot revival setup failed', { error });
      throw error;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextCheck = () => {
      if (!cancelled) {
        timeout = setTimeout(checkReadiness, POLL_INTERVAL_MS);
      }
    };

    const checkReadiness = async () => {
      try {
        const setup = await db.tlonbotRevivalSetup.getValue();
        const shipId = setup.shipId ?? (await db.hostedUserNodeId.getValue());

        if (!shipId) {
          throw new Error('No ship ID found during TlonBot revival setup');
        }

        if (
          !setup.provisioningStarted &&
          !provisioningKickoffStartedRef.current
        ) {
          provisioningKickoffStartedRef.current = true;
          prejoinTlonbotRevivalGroups();
          store
            .markCurrentUserTlonbotEnabled()
            .then(async () => {
              await db.tlonbotRevivalSetup.setValue((current) => ({
                ...current,
                provisioningStarted: true,
                shipId: current.shipId ?? shipId,
              }));
            })
            .catch((error) => {
              provisioningKickoffStartedRef.current = false;
              logger.trackError('Failed to kick off TlonBot provisioning', {
                error,
                shipId,
              });
            });
        }

        const isReady = await api.awaitNodeTlonbotReady(shipId, {
          timeoutMs: 30_000,
          pollIntervalMs: POLL_INTERVAL_MS,
        });
        if (isReady) {
          if (!cancelled) {
            await applyDeferredSetup(shipId);
          }
          return;
        }
      } catch (error) {
        logger.trackError('TlonBot readiness check failed', { error });
      }

      scheduleNextCheck();
    };

    checkReadiness();

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [applyDeferredSetup]);

  return <TlonbotSetupScreenView onLogout={onLogout} loggingOut={loggingOut} />;
}

export function TlonbotSetupScreenView(props: {
  onLogout?: () => void;
  loggingOut?: boolean;
}) {
  return (
    <View
      flex={1}
      backgroundColor="$secondaryBackground"
      testID="tlonbot-setup-screen"
    >
      <ScreenHeader
        backgroundColor="$secondaryBackground"
        leftControls={
          <ScreenHeader.TextButton
            onPress={props.onLogout ?? noop}
            disabled={props.loggingOut}
            color="$tertiaryText"
          >
            Log out
          </ScreenHeader.TextButton>
        }
      />
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2xl">
        <SegmentedSpinner />
        <YStack gap="$2xl" paddingHorizontal="$2xl">
          <TlonText.Text
            fontSize="$xl"
            fontWeight="600"
            marginHorizontal="$xl"
            textAlign="center"
          >
            Setting up your Tlonbot...
          </TlonText.Text>
          <FadingTextCarousel messages={SETUP_MESSAGES} />
        </YStack>
      </YStack>
    </View>
  );
}

async function applyProfileAndNotificationPreferences(
  setup: db.TlonbotRevivalSetup
) {
  if (setup.nickname) {
    await withRetry(
      () =>
        store.updateCurrentUserProfile(
          { nickname: setup.nickname },
          { shouldThrow: true }
        ),
      {
        startingDelay: 1000,
        numOfAttempts: 4,
        maxDelay: 4000,
      }
    ).catch((error) => {
      logger.trackError('TlonBot revival profile update failed', { error });
    });
  }

  if (setup.notificationToken) {
    await withRetry(() => connectNotifyProvider(setup.notificationToken!), {
      startingDelay: 1000,
      numOfAttempts: 4,
      maxDelay: 4000,
    }).catch((error) => {
      logger.trackError('TlonBot revival notification token update failed', {
        error,
      });
    });
  }

  if (setup.notificationLevel) {
    await withRetry(
      () => store.setBaseVolumeLevel({ level: setup.notificationLevel! }),
      {
        startingDelay: 1000,
        numOfAttempts: 4,
        maxDelay: 4000,
      }
    ).catch((error) => {
      logger.trackError('TlonBot revival notification level update failed', {
        error,
      });
    });
  }
}

async function applyBotPreferences(
  shipId: string,
  setup: db.TlonbotRevivalSetup
) {
  if (setup.botName) {
    await withRetry(() => api.setTlawnNickname(shipId, setup.botName!), {
      startingDelay: 750,
      numOfAttempts: 4,
      maxDelay: 4000,
    }).catch((error) => {
      logger.trackError('TlonBot revival bot nickname update failed', {
        error,
      });
    });
  }

  const botAvatarUrl = await resolveDeferredBotAvatarUrl(setup);
  if (botAvatarUrl) {
    await withRetry(() => api.setTlawnAvatar(shipId, botAvatarUrl), {
      startingDelay: 750,
      numOfAttempts: 4,
      maxDelay: 4000,
    }).catch((error) => {
      logger.trackError('TlonBot revival bot avatar update failed', { error });
    });
  }

  if (
    setup.botProvider &&
    setup.botProvider !== BASIC_PROVIDER_ID &&
    setup.botModel
  ) {
    const userId = await db.hostingUserId.getValue();
    if (!userId) {
      logger.trackError('TlonBot revival model update failed', {
        step: 'missing_user_id',
      });
      return;
    }

    await withRetry(
      () =>
        api.setTlawnPrimaryModel(userId, {
          provider: setup.botProvider!,
          model: setup.botModel!,
        }),
      {
        startingDelay: 750,
        numOfAttempts: 4,
        maxDelay: 4000,
      }
    )
      .then(async () => {
        const running = await api.awaitBotRunning(shipId, {
          timeoutMs: 30_000,
          pollIntervalMs: 1500,
        });
        if (!running) {
          logger.trackError(
            'TlonBot revival model update readiness timed out',
            {
              provider: setup.botProvider,
              model: setup.botModel,
            }
          );
        }
      })
      .catch((error) => {
        logger.trackError('TlonBot revival model update failed', { error });
      });
  }
}

async function resolveDeferredBotAvatarUrl(setup: db.TlonbotRevivalSetup) {
  if (setup.botAvatarUploadIntent) {
    return withRetry(
      async () => {
        const uploadIntent = setup.botAvatarUploadIntent!;
        const uploadKey = Attachment.UploadIntent.extractKey(uploadIntent);
        await store.uploadAsset(uploadIntent);
        const uploadStates = await store.waitForUploads([uploadKey]);
        const uploadState = uploadStates[uploadKey];

        if (uploadState?.status !== 'success') {
          throw new Error('Deferred avatar upload did not finish successfully');
        }

        return uploadState.remoteUri;
      },
      {
        startingDelay: 1000,
        numOfAttempts: 3,
        maxDelay: 4000,
      }
    ).catch((error) => {
      logger.trackError('TlonBot revival deferred avatar upload failed', {
        error,
      });
      return null;
    });
  }

  if (setup.botAvatarUrl && /^(?!file|data).+/.test(setup.botAvatarUrl)) {
    return setup.botAvatarUrl;
  }

  if (setup.botAvatarUrl) {
    logger.trackError('TlonBot revival bot avatar update failed', {
      step: 'missing_upload_intent',
    });
  }

  return null;
}
