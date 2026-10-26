import type { TlawnProviderModel } from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { View } from 'tamagui';

import type { SubscriptionProvider } from '../../../../features/settings/bot/constants';
import { BotModelPane } from '../SplashSequence';
import { resolveInitialProviderModel } from '../providerModelDefaults';
import { ChooseModelScreen, ModelSwitchSheet } from './ChooseModelScreen';
import { ConnectServicesScreen } from './ConnectServicesScreen';
import { FirstRunApiKeyScreen } from './FirstRunApiKeyScreen';
import { FirstRunIntroScreen } from './FirstRunIntroScreen';
import { FirstRunSetupScreen } from './FirstRunSetupScreen';
import { MakeSpaceScreen } from './MakeSpaceScreen';
import {
  API_KEY_PROVIDERS,
  type FirstRunModelRow,
  type FirstRunModelSection,
  INCLUDED_ROW_ID,
  defaultModelRowId,
} from './firstRunModelOptions';
import type { FeaturedService, ServiceAttempt } from './firstRunServices';
import type { FirstRunSetupStatus } from './types';

const logger = createDevLogger('FirstRunSequence', false);

/** Where Back goes from each screen. */
const PREVIOUS_PANE: Partial<Record<FirstRunPane, FirstRunPane>> = {
  private: 'meet',
  connect: 'private',
  allServices: 'connect',
  model: 'connect',
  subscriptionSignIn: 'model',
  apiKey: 'model',
  apiKeyModel: 'apiKey',
  space: 'model',
  setup: 'space',
};

export type FirstRunPane =
  | 'meet'
  | 'private'
  | 'connect'
  | 'allServices'
  | 'model'
  | 'subscriptionSignIn'
  | 'apiKey'
  | 'apiKeyModel'
  | 'space'
  | 'setup';

/** Background setup, run by the onboarding bridge. */
export type FirstRunSetupAdapter = {
  status: FirstRunSetupStatus;
  retry: () => void;
  /** Leave without the Tlonbot, as onboarding did before on a timeout. */
  skip?: () => void;
};

export type FirstRunServicesAdapter = {
  loading: boolean;
  unavailable: boolean;
  featured: FeaturedService[];
  attempts: Record<string, ServiceAttempt | undefined>;
  anyConnected: boolean;
  allServicesCount: number;
  startConnect: (providerId: string) => void;
  checkAgain: (providerId: string) => void;
  /** The full Connect services screen, shown inside the cover. */
  renderAllServices: (onBack: () => void) => ReactNode;
};

export type FirstRunModelsAdapter = {
  sections: FirstRunModelSection[];
  includedName: string;
  /** The included model's id, to switch back to after another choice. */
  includedModelId: string;
  /** Subscription sign-in needs the bot, so it waits for this. */
  botReady: boolean;
  renderSubscriptionSignIn: (
    provider: SubscriptionProvider,
    handlers: {
      onDone: (models: TlawnProviderModel[]) => void;
      onCancel: () => void;
    }
  ) => ReactNode;
  /** Save the key and list its models; throws with words to show. */
  checkApiKey: (
    provider: string,
    apiKey: string
  ) => Promise<TlawnProviderModel[]>;
  /** Point the bot at a model. Runs in the background. */
  applyModel: (provider: string, model: string) => void;
};

/**
 * The five-screen first run after signup. Setup runs in the background the
 * whole time; only "Let's get started" waits for it. Choices stay in place
 * when someone goes back.
 */
export function FirstRunSequence({
  setup,
  services,
  models,
  onOpenChat,
  initialPane = 'meet',
}: {
  setup: FirstRunSetupAdapter;
  services: FirstRunServicesAdapter;
  models: FirstRunModelsAdapter;
  onOpenChat: () => void;
  initialPane?: FirstRunPane;
}) {
  const [pane, setPane] = useState<FirstRunPane>(initialPane);
  // Until someone picks, the recommended row is selected; it can change once
  // the hosting config arrives.
  const [pickedModelId, setPickedModelId] = useState<string | null>(null);
  const selectedModelId = pickedModelId ?? defaultModelRowId(models.sections);
  // The choice the bot was last pointed at. Hosting starts it on the
  // included model.
  const [appliedModelId, setAppliedModelId] = useState(INCLUDED_ROW_ID);
  const [switchRow, setSwitchRow] = useState<FirstRunModelRow | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [apiKeyProvider, setApiKeyProvider] = useState<string>(
    API_KEY_PROVIDERS[0].id
  );
  const [apiKey, setApiKey] = useState('');
  const [apiKeyChecking, setApiKeyChecking] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [keyModels, setKeyModels] = useState<TlawnProviderModel[]>([]);
  const [keyModel, setKeyModel] = useState('');

  useEffect(() => {
    logger.trackEvent('First Run Pane Viewed', { pane });
  }, [pane]);

  const goBack = useCallback(() => {
    const previous = PREVIOUS_PANE[pane];
    if (previous) setPane(previous);
  }, [pane]);

  // Android's back button steps back through the screens, as Back does.
  useEffect(() => {
    if (!PREVIOUS_PANE[pane]) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        goBack();
        return true;
      }
    );
    return () => subscription.remove();
  }, [goBack, pane]);

  // Waiting for setup after "Let's get started": open the chat once ready.
  useEffect(() => {
    if (pane === 'setup' && setup.status === 'ready') onOpenChat();
  }, [onOpenChat, pane, setup.status]);

  const handleStart = useCallback(() => {
    if (setup.status === 'ready') {
      onOpenChat();
    } else {
      setPane('setup');
    }
  }, [onOpenChat, setup.status]);

  const handleModelContinue = useCallback(
    (row: FirstRunModelRow) => {
      if (row.id === appliedModelId) {
        setPane('space');
        return;
      }
      if (row.keepsZdr) {
        // Back to the included model after trying something else.
        models.applyModel('basic', models.includedModelId);
        setAppliedModelId(row.id);
        setPane('space');
        return;
      }
      setSwitchRow(row);
      setSwitchOpen(true);
    },
    [appliedModelId, models]
  );

  const handleSwitchContinue = useCallback(() => {
    if (!switchRow) return;
    setSwitchOpen(false);
    setPane(
      switchRow.choice.kind === 'subscription' ? 'subscriptionSignIn' : 'apiKey'
    );
  }, [switchRow]);

  const handleKeepIncluded = useCallback(() => {
    setSwitchOpen(false);
    setPickedModelId(INCLUDED_ROW_ID);
  }, []);

  const handleCheckApiKey = useCallback(async () => {
    setApiKeyChecking(true);
    setApiKeyError(null);
    const result = await models.checkApiKey(apiKeyProvider, apiKey.trim()).then(
      (found) => ({ found }),
      (error: unknown) => ({ error })
    );
    setApiKeyChecking(false);
    if ('error' in result) {
      setApiKeyError(
        result.error instanceof Error && result.error.message
          ? result.error.message
          : 'Could not check this key. Check it and try again.'
      );
      return;
    }
    setKeyModels(result.found);
    setKeyModel((current) =>
      resolveInitialProviderModel(apiKeyProvider, result.found, current)
    );
    setPane('apiKeyModel');
  }, [apiKey, apiKeyProvider, models]);

  const handleSaveKeyModel = useCallback(() => {
    if (!keyModel) return;
    models.applyModel(apiKeyProvider, keyModel);
    setAppliedModelId('api-key');
    setPane('space');
  }, [apiKeyProvider, keyModel, models]);

  const subscriptionProvider =
    switchRow?.choice.kind === 'subscription'
      ? switchRow.choice.provider
      : null;

  const handleSubscriptionDone = useCallback(
    (found: TlawnProviderModel[]) => {
      if (!subscriptionProvider || !switchRow) return;
      const model =
        resolveInitialProviderModel(subscriptionProvider, found, '') ||
        found[0]?.id;
      if (model) {
        models.applyModel(subscriptionProvider, model);
        setAppliedModelId(switchRow.id);
      } else {
        logger.trackError('First run subscription returned no models', {
          provider: subscriptionProvider,
        });
      }
      setPane('space');
    },
    [models, subscriptionProvider, switchRow]
  );

  const status = setup.status;

  return (
    <View flex={1} backgroundColor="$background">
      {pane === 'meet' ? (
        <FirstRunIntroScreen
          slide={1}
          status={status}
          onNext={() => setPane('private')}
        />
      ) : pane === 'private' ? (
        <FirstRunIntroScreen
          slide={2}
          status={status}
          onNext={() => setPane('connect')}
          onBack={goBack}
        />
      ) : pane === 'connect' ? (
        <ConnectServicesScreen
          status={status}
          loading={services.loading}
          unavailable={services.unavailable}
          featured={services.featured}
          attempts={services.attempts}
          allServicesCount={services.allServicesCount}
          anyConnected={services.anyConnected}
          onStartConnect={services.startConnect}
          onCheckAgain={services.checkAgain}
          onAllServices={() => setPane('allServices')}
          onContinue={() => setPane('model')}
          onBack={goBack}
        />
      ) : pane === 'allServices' ? (
        services.renderAllServices(goBack)
      ) : pane === 'model' ? (
        <ChooseModelScreen
          status={status}
          sections={models.sections}
          selectedId={selectedModelId}
          onSelect={setPickedModelId}
          onContinue={handleModelContinue}
          onBack={goBack}
        />
      ) : pane === 'subscriptionSignIn' && subscriptionProvider ? (
        models.renderSubscriptionSignIn(subscriptionProvider, {
          onDone: handleSubscriptionDone,
          onCancel: () => setPane('model'),
        })
      ) : pane === 'apiKey' ? (
        <FirstRunApiKeyScreen
          status={status}
          provider={apiKeyProvider}
          apiKey={apiKey}
          checking={apiKeyChecking}
          error={apiKeyError}
          onProviderChange={(provider) => {
            setApiKeyProvider(provider);
            setApiKeyError(null);
          }}
          onApiKeyChange={(key) => {
            setApiKey(key);
            setApiKeyError(null);
          }}
          onSubmit={() => void handleCheckApiKey()}
          onBack={goBack}
        />
      ) : pane === 'apiKeyModel' ? (
        <BotModelPane
          models={keyModels}
          selectedModel={keyModel}
          onSelectModel={setKeyModel}
          onBackPress={goBack}
          onActionPress={handleSaveKeyModel}
        />
      ) : pane === 'space' ? (
        <MakeSpaceScreen
          status={status}
          onStart={handleStart}
          onBack={goBack}
        />
      ) : (
        <FirstRunSetupScreen
          failed={status === 'failed'}
          onRetry={setup.retry}
          onSkip={setup.skip}
        />
      )}

      {switchRow ? (
        <ModelSwitchSheet
          row={switchRow}
          includedName={models.includedName}
          botReady={models.botReady}
          open={switchOpen}
          onOpenChange={setSwitchOpen}
          onContinue={handleSwitchContinue}
          onKeepIncluded={handleKeepIncluded}
        />
      ) : null}
    </View>
  );
}
