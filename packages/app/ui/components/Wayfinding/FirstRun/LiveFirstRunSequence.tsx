import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'tamagui';

import {
  type SubscriptionProvider,
  getIncludedModelId,
  providerLabel,
  subscriptionLabel,
} from '../../../../features/settings/bot/constants';
import { useOpenAISubscriptionAuth } from '../../../../features/settings/bot/useOpenAISubscriptionAuth';
import { BotSettingsScreenView } from '../../BotSettingsScreenView';
import { LLMSubscriptionAuthView } from '../../LLMSubscriptionAuthView';
import {
  applyBotPrimaryModel,
  saveProviderKeyAndListModels,
} from '../botModelSetup';
import { startBotReadinessPolling } from '../botProviderOptions';
import { initializeSubscriptionModels } from '../providerModelDefaults';
import {
  type FirstRunModelsAdapter,
  FirstRunSequence,
  type FirstRunServicesAdapter,
  type FirstRunSetupAdapter,
} from './FirstRunSequence';
import {
  buildFirstRunModelSections,
  includedModelName,
} from './firstRunModelOptions';
import { useFirstRunServices } from './useFirstRunServices';

const logger = createDevLogger('LiveFirstRunSequence', false);

/** The first run against this account's real catalog, grants and bot. */
export function LiveFirstRunSequence({
  setup,
  onOpenChat,
}: {
  setup: FirstRunSetupAdapter;
  onOpenChat: () => void;
}) {
  const services = useLiveServices();
  const models = useLiveModels(setup.status === 'ready');
  return (
    <FirstRunSequence
      setup={setup}
      services={services}
      models={models}
      onOpenChat={onOpenChat}
    />
  );
}

/** The full services list. While it's open, its events get toasts. */
function AllServicesPane({
  onOpenChange,
  ...props
}: ComponentProps<typeof BotSettingsScreenView> & {
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    onOpenChange(true);
    return () => onOpenChange(false);
  }, [onOpenChange]);
  return <BotSettingsScreenView {...props} />;
}

function useLiveServices(): FirstRunServicesAdapter {
  const live = useFirstRunServices();
  const { connections, setAllServicesOpen } = live;
  const renderAllServices = useCallback(
    (onBack: () => void) => (
      <AllServicesPane
        onOpenChange={setAllServicesOpen}
        available={connections.status?.available ?? false}
        busyProviderId={connections.busyProviderId}
        initialLoading={connections.initialLoading}
        onBackPressed={onBack}
        onConnectProvider={(providerId) => void connections.connect(providerId)}
        onDisconnectProvider={(providerId) =>
          void connections.disconnect(providerId)
        }
        onRefresh={() => void connections.refreshStatus()}
        providers={connections.providers}
        refreshing={connections.refreshing}
        showUnavailableNotice={
          connections.hostingSessionUnavailable ||
          connections.status?.available === false
        }
      />
    ),
    [connections, setAllServicesOpen]
  );
  return {
    loading: connections.initialLoading,
    unavailable: live.unavailable,
    featured: live.featured,
    attempts: live.attempts,
    anyConnected: live.anyConnected,
    allServicesCount: connections.providers.length,
    startConnect: live.startConnect,
    checkAgain: live.checkAgain,
    renderAllServices,
  };
}

function useLiveModels(setupReady: boolean): FirstRunModelsAdapter {
  const [providerConfig, setProviderConfig] =
    useState<api.TlawnProviderConfigInfo | null>(null);
  const [ids, setIds] = useState<{
    userId: string | null;
    shipId: string | null;
  }>({ userId: null, shipId: null });
  const [botReadyPolled, setBotReadyPolled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [userId, shipId] = await Promise.all([
        db.hostingUserId.getValue(),
        db.hostedUserNodeId.getValue(),
      ]);
      if (cancelled) return;
      setIds({ userId, shipId });
      if (!userId) return;
      try {
        const config = await api.getTlawnProviderKeys(userId);
        if (!cancelled) setProviderConfig(config);
      } catch (error) {
        logger.trackError('First run could not load the model config', {
          error,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscription sign-in runs through the bot, so it waits until the bot is
  // ready. Setup finishing implies it; until then, ask hosting.
  useEffect(() => {
    const shipId = ids.shipId;
    if (!shipId || setupReady) return;
    let loggedError = false;
    return startBotReadinessPolling({
      checkReadiness: () => api.checkNodeIsTlonbotReady(shipId),
      onReady: () => setBotReadyPolled(true),
      onError: (error) => {
        if (loggedError) return;
        loggedError = true;
        logger.trackError('First run bot readiness check failed', { error });
      },
    });
  }, [ids.shipId, setupReady]);

  const sections = useMemo(
    () => buildFirstRunModelSections(providerConfig),
    [providerConfig]
  );

  const checkApiKey = useCallback(
    async (provider: string, apiKey: string) => {
      if (!ids.userId) {
        throw new Error('Could not check this key. Please try again.');
      }
      return saveProviderKeyAndListModels({
        userId: ids.userId,
        provider,
        apiKey,
      });
    },
    [ids.userId]
  );

  const applyModel = useCallback(
    (provider: string, model: string) =>
      applyBotPrimaryModel({
        userId: ids.userId,
        shipId: ids.shipId,
        provider,
        model,
      }),
    [ids.shipId, ids.userId]
  );

  const renderSubscriptionSignIn = useCallback<
    FirstRunModelsAdapter['renderSubscriptionSignIn']
  >(
    (provider, handlers) =>
      ids.shipId ? (
        <FirstRunSubscriptionSignIn
          ship={desig(ids.shipId)}
          provider={provider}
          onDone={handlers.onDone}
          onCancel={handlers.onCancel}
        />
      ) : null,
    [ids.shipId]
  );

  return {
    sections,
    includedName: includedModelName(providerConfig ?? undefined),
    includedModelId: getIncludedModelId(providerConfig ?? undefined),
    botReady: botReadyPolled || setupReady,
    renderSubscriptionSignIn,
    checkApiKey,
    applyModel,
  };
}

/** The app's subscription sign-in, started as soon as it shows. */
function FirstRunSubscriptionSignIn({
  ship,
  provider,
  onDone,
  onCancel,
}: {
  ship: string;
  provider: SubscriptionProvider;
  onDone: (models: api.TlawnProviderModel[]) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [startError, setStartError] = useState<string | null>(null);
  const auth = useOpenAISubscriptionAuth({
    ship,
    provider,
    onComplete: (models) =>
      onDone(initializeSubscriptionModels(provider, models, '').providerModels),
  });
  const { start } = auth;

  const handleStart = useCallback(async () => {
    setStartError(null);
    try {
      await start();
    } catch (error) {
      logger.trackError('First run subscription sign-in failed to start', {
        error,
        provider,
      });
      setStartError('Could not start sign-in. Please try again.');
    }
  }, [provider, start]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void handleStart();
  }, [handleStart]);

  return (
    <View
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      <LLMSubscriptionAuthView
        state={auth.state}
        browserError={auth.browserError ?? startError}
        onStart={() => void handleStart()}
        onOpenBrowser={() => void auth.openVerificationUrl()}
        onSubmitToken={auth.completeToken}
        onRetry={() => void auth.restart()}
        onCancel={() => {
          auth.dismiss();
          onCancel();
        }}
        provider={provider}
        providerLabel={providerLabel(provider)}
        subscriptionLabel={subscriptionLabel(provider)}
      />
    </View>
  );
}
