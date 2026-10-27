import type { TlawnProviderModel } from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import { useToast } from '@tloncorp/ui';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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
import { firstRunCopy } from './firstRunCopy';
import {
  API_KEY_PROVIDERS,
  type FirstRunModelRow,
  type FirstRunModelSection,
  INCLUDED_ROW_ID,
  defaultModelRowId,
} from './firstRunModelOptions';
import type { FeaturedService, ServiceAttempt } from './firstRunServices';
import { createModelSwitchQueue } from './modelSwitchQueue';
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
};

export type FirstRunServicesAdapter = {
  unavailable: boolean;
  featured: FeaturedService[];
  attempts: Record<string, ServiceAttempt | undefined>;
  anyConnected: boolean;
  /** Another connect or disconnect is running, so new sign-ins wait. */
  busy: boolean;
  /** Null until the live catalog is in. */
  allServicesCount: number | null;
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
  /** Whether the bot is on the included model as the first run opens. */
  onIncludedModel: boolean;
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
  /**
   * Point the bot at a model. Runs in the background and resolves false if
   * the bot didn't take the change.
   */
  applyModel: (provider: string, model: string) => Promise<boolean>;
};

function SubscriptionSignInPane({
  render,
  provider,
  onDone,
  onCancel,
}: {
  render: FirstRunModelsAdapter['renderSubscriptionSignIn'];
  provider: SubscriptionProvider;
  onDone: (models: TlawnProviderModel[]) => void;
  onCancel: () => void;
}) {
  return <>{render(provider, { onDone, onCancel })}</>;
}

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
  // The choice the bot is confirmed to be on: the last switch that took here,
  // else the included model if hosting's config says so. A bot left on
  // another model by an earlier, unfinished first run matches no row, so
  // whatever is chosen gets applied. A switch in flight is tracked
  // separately, so a failed one can be retried by continuing with the same
  // choice.
  const [switchedModelId, setSwitchedModelId] = useState<string | null>(null);
  const appliedModelId =
    switchedModelId ?? (models.onIncludedModel ? INCLUDED_ROW_ID : null);
  const [applyingModelId, setApplyingModelId] = useState<string | null>(null);
  const [runSwitch] = useState(createModelSwitchQueue);
  const mountedRef = useRef(true);
  const showToast = useToast();
  const [switchRow, setSwitchRow] = useState<FirstRunModelRow | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [apiKeyProvider, setApiKeyProvider] = useState<string>(
    API_KEY_PROVIDERS[0].id
  );
  const [apiKey, setApiKey] = useState('');
  const [apiKeyChecking, setApiKeyChecking] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  // The models a checked key reached, kept with the provider they belong to.
  const [keyModels, setKeyModels] = useState<{
    provider: string;
    models: TlawnProviderModel[];
  }>({ provider: API_KEY_PROVIDERS[0].id, models: [] });
  const [keyModel, setKeyModel] = useState('');

  useEffect(() => {
    logger.trackEvent('First Run Pane Viewed', { pane });
  }, [pane]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const goBack = useCallback(() => {
    // A key check in flight decides where to go next.
    if (pane === 'apiKey' && apiKeyChecking) return;
    const previous = PREVIOUS_PANE[pane];
    if (previous) setPane(previous);
  }, [apiKeyChecking, pane]);

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

  // Waiting for setup after "Let's get started": open the chat once it's
  // ready, or once setup runs late and carries on in the background.
  const chatCanOpen = setup.status !== 'running';
  useEffect(() => {
    if (pane === 'setup' && chatCanOpen) onOpenChat();
  }, [chatCanOpen, onOpenChat, pane]);

  const handleStart = useCallback(() => {
    if (chatCanOpen) {
      onOpenChat();
    } else {
      setPane('setup');
    }
  }, [chatCanOpen, onOpenChat]);

  // Switch the bot in the background, one switch at a time so an older one
  // can't save after a newer choice. Only the latest switch counts, and if it
  // doesn't take, say so: in place while the first run is open, and as a
  // pointer to settings once the chat has opened.
  const applyChoice = useCallback(
    (rowId: string, name: string, provider: string, model: string) => {
      setApplyingModelId(rowId);
      void runSwitch(() =>
        models.applyModel(provider, model).catch(() => false)
      ).then((outcome) => {
        if (outcome.superseded) return;
        const applied = outcome.value;
        const stillOpen = mountedRef.current;
        if (stillOpen) {
          setApplyingModelId(null);
          if (applied) setSwitchedModelId(rowId);
        }
        if (!applied) {
          logger.trackError('First run model switch failed', {
            provider,
            model,
          });
          showToast({
            message: stillOpen
              ? firstRunCopy.model.switchFailed(name)
              : firstRunCopy.model.switchFailedLater(name),
            duration: 6000,
          });
        }
      });
    },
    [models, runSwitch, showToast]
  );

  const handleModelContinue = useCallback(
    (row: FirstRunModelRow) => {
      if (row.id === (applyingModelId ?? appliedModelId)) {
        setPane('space');
        return;
      }
      if (row.keepsZdr) {
        // Back to the included model after trying something else.
        applyChoice(
          row.id,
          models.includedName,
          'basic',
          models.includedModelId
        );
        setPane('space');
        return;
      }
      setSwitchRow(row);
      setSwitchOpen(true);
    },
    [appliedModelId, applyChoice, applyingModelId, models]
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
    // The models found belong to this provider, whatever is picked later.
    const provider = apiKeyProvider;
    setApiKeyChecking(true);
    setApiKeyError(null);
    const result = await models.checkApiKey(provider, apiKey.trim()).then(
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
    setKeyModels({ provider, models: result.found });
    setKeyModel((current) =>
      resolveInitialProviderModel(provider, result.found, current)
    );
    setPane((current) => (current === 'apiKey' ? 'apiKeyModel' : current));
  }, [apiKey, apiKeyProvider, models]);

  const handleSaveKeyModel = useCallback(() => {
    if (!keyModel) return;
    const providerName =
      API_KEY_PROVIDERS.find((option) => option.id === keyModels.provider)
        ?.label ?? keyModels.provider;
    applyChoice('api-key', providerName, keyModels.provider, keyModel);
    setPane('space');
  }, [applyChoice, keyModel, keyModels.provider]);

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
        applyChoice(switchRow.id, switchRow.name, subscriptionProvider, model);
      } else {
        logger.trackError('First run subscription returned no models', {
          provider: subscriptionProvider,
        });
      }
      setPane('space');
    },
    [applyChoice, subscriptionProvider, switchRow]
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
          unavailable={services.unavailable}
          featured={services.featured}
          attempts={services.attempts}
          allServicesCount={services.allServicesCount}
          anyConnected={services.anyConnected}
          busy={services.busy}
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
        <SubscriptionSignInPane
          render={models.renderSubscriptionSignIn}
          provider={subscriptionProvider}
          onDone={handleSubscriptionDone}
          onCancel={() => setPane('model')}
        />
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
          models={keyModels.models}
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
        <FirstRunSetupScreen />
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
