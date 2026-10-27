import type { TlawnOAuthProvider, TlawnProviderModel } from '@tloncorp/api';
import { Button, Text } from '@tloncorp/ui';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useValue } from 'react-cosmos/client';
import { LogBox } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import type { McpProviderRow } from '../lib/mcpProviders';
import { BotSettingsScreenView } from '../ui/components/BotSettingsScreenView';
import {
  ChooseModelScreen,
  ModelSwitchSheet,
} from '../ui/components/Wayfinding/FirstRun/ChooseModelScreen';
import { ConnectServicesScreen } from '../ui/components/Wayfinding/FirstRun/ConnectServicesScreen';
import { FirstRunApiKeyScreen } from '../ui/components/Wayfinding/FirstRun/FirstRunApiKeyScreen';
import { FirstRunIntroScreen } from '../ui/components/Wayfinding/FirstRun/FirstRunIntroScreen';
import {
  type FirstRunModelsAdapter,
  FirstRunSequence,
  type FirstRunServicesAdapter,
} from '../ui/components/Wayfinding/FirstRun/FirstRunSequence';
import { FirstRunSetupScreen } from '../ui/components/Wayfinding/FirstRun/FirstRunSetupScreen';
import { MakeSpaceScreen } from '../ui/components/Wayfinding/FirstRun/MakeSpaceScreen';
import {
  buildFirstRunModelSections,
  findModelRow,
  includedModelName,
} from '../ui/components/Wayfinding/FirstRun/firstRunModelOptions';
import {
  type ServiceAttempt,
  attemptAfterCheck,
  selectFeaturedServices,
} from '../ui/components/Wayfinding/FirstRun/firstRunServices';
import type { FirstRunSetupStatus } from '../ui/components/Wayfinding/FirstRun/types';
import { FixtureWrapper } from './FixtureWrapper';

// The wrapper's test node client logs this when fixtures switch; it is not
// about these screens, and its toast covers the button.
LogBox.ignoreLogs(['Failed to DELETE channel']);

const LOGO = (id: string) =>
  `https://storage.googleapis.com/tlon-prod-memex-assets/oauth/${id}.png`;

// The live catalog's first entries, as of 26 Oct 2026.
const CATALOG: TlawnOAuthProvider[] = [
  [
    'google-calendar',
    'Google Calendar',
    'openid email profile https://www.googleapis.com/auth/calendar',
  ],
  [
    'google-gmail',
    'Send Gmail',
    'openid email profile https://www.googleapis.com/auth/gmail.send',
  ],
  ['notion', 'Notion', ''],
  ['github', 'GitHub', 'read:user user:email repo'],
  [
    'google-drive',
    'Google Drive',
    'openid email profile https://www.googleapis.com/auth/drive.file',
  ],
  ['airtable', 'Airtable', 'data.records:read data.records:write'],
  ['atlassian', 'Atlassian', 'read:jira-work write:jira-work'],
].map(([id, displayName, scopes]) => ({
  id,
  displayName,
  scopes,
  kind: 'standard' as const,
  logoUrl: LOGO(id),
  suggestedUpstream: {
    mode: 'proxy' as const,
    name: id,
    url: 'https://example.com',
  },
  template: id,
}));

// The real catalog has 88 services; the app hides one.
const ALL_SERVICES_COUNT = 87;

const rowsFor = (connected: string[] = []): McpProviderRow[] =>
  CATALOG.map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
    logoUrl: provider.logoUrl,
    status: connected.includes(provider.id) ? 'connected' : 'not-connected',
  }));

const HOSTED_CONFIG = {
  keys: {},
  models: [],
  defaultKeys: { basic: { key: 'included' } },
  defaultModels: { primaryModel: 'openai/gpt-5.6-luna', fallbackModels: [] },
};

const FAKE_MODELS: TlawnProviderModel[] = [
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
  { id: 'gpt-5.6', name: 'GPT-5.6' },
  { id: 'gpt-5.6-mini', name: 'GPT-5.6 mini' },
];

const noop = () => {};

function Frame({ children }: { children: ReactNode }) {
  return (
    <FixtureWrapper fillWidth fillHeight>
      {children}
    </FixtureWrapper>
  );
}

function useSetupStatus(): FirstRunSetupStatus {
  const [status] = useValue<FirstRunSetupStatus>('Setup', {
    defaultValue: 'running',
  });
  return status;
}

function MeetFixture() {
  return (
    <Frame>
      <FirstRunIntroScreen slide={1} status="running" onNext={noop} />
    </Frame>
  );
}

function PrivateFixture() {
  const status = useSetupStatus();
  return (
    <Frame>
      <FirstRunIntroScreen
        slide={2}
        status={status}
        onNext={noop}
        onBack={noop}
      />
    </Frame>
  );
}

function ConnectFixture({
  attempt,
  connected,
  none,
  sheet,
}: {
  attempt?: ServiceAttempt;
  connected?: boolean;
  none?: boolean;
  sheet?: boolean;
}) {
  const status = useSetupStatus();
  const rows = rowsFor(connected ? ['google-calendar'] : []);
  const featured = selectFeaturedServices(CATALOG, rows);
  return (
    <Frame>
      <ConnectServicesScreen
        status={status}
        unavailable={!!none}
        featured={featured}
        attempts={attempt ? { 'google-calendar': attempt } : {}}
        allServicesCount={ALL_SERVICES_COUNT}
        anyConnected={!!connected}
        onStartConnect={noop}
        onCheckAgain={noop}
        onAllServices={noop}
        onContinue={noop}
        onBack={noop}
        initialSheetProviderId={sheet ? 'google-calendar' : undefined}
      />
    </Frame>
  );
}

function AllServicesFixture() {
  const [afterConnecting] = useValue('After connecting', {
    defaultValue: false,
  });
  return (
    <Frame>
      <BotSettingsScreenView
        available
        busyProviderId={null}
        initialLoading={false}
        onBackPressed={noop}
        onConnectProvider={noop}
        onDisconnectProvider={noop}
        onRefresh={noop}
        providers={rowsFor(afterConnecting ? ['google-calendar'] : [])}
        refreshing={false}
        showUnavailableNotice={false}
      />
    </Frame>
  );
}

function ModelFixture({
  sheetFor,
  botReady = true,
}: {
  sheetFor?: string;
  botReady?: boolean;
}) {
  const status = useSetupStatus();
  const sections = useMemo(() => buildFirstRunModelSections(HOSTED_CONFIG), []);
  const [selected, setSelected] = useState(sheetFor ?? 'included');
  const sheetRow = sheetFor ? findModelRow(sections, sheetFor) : undefined;
  const [sheetOpen, setSheetOpen] = useState(!!sheetRow);
  return (
    <Frame>
      <ChooseModelScreen
        status={status}
        sections={sections}
        selectedId={selected}
        onSelect={setSelected}
        onContinue={() => setSheetOpen(!!sheetRow)}
        onBack={noop}
      />
      {sheetRow ? (
        <ModelSwitchSheet
          row={sheetRow}
          includedName={includedModelName(HOSTED_CONFIG)}
          botReady={botReady}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onContinue={() => setSheetOpen(false)}
          onKeepIncluded={() => {
            setSheetOpen(false);
            setSelected('included');
          }}
        />
      ) : null}
    </Frame>
  );
}

function ApiKeyFixture() {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  return (
    <Frame>
      <FirstRunApiKeyScreen
        status="running"
        provider={provider}
        apiKey={apiKey}
        checking={false}
        error={null}
        onProviderChange={setProvider}
        onApiKeyChange={setApiKey}
        onSubmit={noop}
        onBack={noop}
      />
    </Frame>
  );
}

function SpaceFixture() {
  const [status] = useValue<FirstRunSetupStatus>('Setup', {
    defaultValue: 'ready',
  });
  return (
    <Frame>
      <MakeSpaceScreen status={status} onStart={noop} onBack={noop} />
    </Frame>
  );
}

function SetupFixture() {
  return (
    <Frame>
      <FirstRunSetupScreen />
    </Frame>
  );
}

/** Stands in for the provider's subscription sign-in. */
function FakeSubscriptionSignIn({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <YStack
      flex={1}
      paddingTop={insets.top + 48}
      paddingHorizontal="$2xl"
      gap="$xl"
      backgroundColor="$background"
    >
      <Text size="$label/xl">The provider’s sign-in shows here.</Text>
      <Button preset="hero" label="Finish signing in" onPress={onDone} />
      <Button preset="minimal" centered label="Cancel" onPress={onCancel} />
    </YStack>
  );
}

type FlowSettings = {
  readyAfterSeconds: number;
  setupRunsLate: boolean;
  botReadyAfterSeconds: number;
  connectResult: 'connected' | 'checking' | 'cancelled';
  checkAgainFindsGrant: boolean;
  modelSwitchFails: boolean;
  noServices: boolean;
};

// Walk through it as a new person would. Setup finishes (or runs late) on a
// timer, services connect after a pause, and opening the chat starts over.
function FlowFixture({
  readyAfter = 20,
  late = false,
  connectEnds = 'connected',
  checkFinds = true,
  switchFails = false,
}: {
  readyAfter?: number;
  late?: boolean;
  connectEnds?: FlowSettings['connectResult'];
  checkFinds?: boolean;
  switchFails?: boolean;
}) {
  const [readyAfterSeconds] = useValue('Setup ready after (seconds)', {
    defaultValue: readyAfter,
  });
  const [setupRunsLate] = useValue('Setup runs late', { defaultValue: late });
  const [botReadyAfterSeconds] = useValue('Bot ready after (seconds)', {
    defaultValue: 10,
  });
  const [connectResult] = useValue<FlowSettings['connectResult']>(
    'Connecting a service ends',
    { defaultValue: connectEnds }
  );
  const [checkAgainFindsGrant] = useValue('Check again finds the grant', {
    defaultValue: checkFinds,
  });
  const [modelSwitchFails] = useValue('Model switch fails', {
    defaultValue: switchFails,
  });
  const [noServices] = useValue('Nothing to connect', { defaultValue: false });
  const [run, setRun] = useState(0);
  return (
    <Frame>
      <FlowRun
        key={run}
        settings={{
          readyAfterSeconds,
          setupRunsLate,
          botReadyAfterSeconds,
          connectResult,
          checkAgainFindsGrant,
          modelSwitchFails,
          noServices,
        }}
        onRestart={() => setRun((value) => value + 1)}
      />
    </Frame>
  );
}

function FlowRun({
  settings,
  onRestart,
}: {
  settings: FlowSettings;
  onRestart: () => void;
}) {
  const [status, setStatus] = useState<FirstRunSetupStatus>('running');
  const [botReady, setBotReady] = useState(false);
  const [connected, setConnected] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<
    Record<string, ServiceAttempt | undefined>
  >({});
  const {
    readyAfterSeconds,
    setupRunsLate,
    botReadyAfterSeconds,
    connectResult,
    checkAgainFindsGrant,
    modelSwitchFails,
  } = settings;

  useEffect(() => {
    const timer = setTimeout(
      () => setStatus(setupRunsLate ? 'late' : 'ready'),
      readyAfterSeconds * 1000
    );
    return () => clearTimeout(timer);
  }, [readyAfterSeconds, setupRunsLate]);

  useEffect(() => {
    const timer = setTimeout(
      () => setBotReady(true),
      botReadyAfterSeconds * 1000
    );
    return () => clearTimeout(timer);
  }, [botReadyAfterSeconds]);

  const rows = useMemo(() => rowsFor(connected), [connected]);
  const startConnect = useCallback(
    (id: string) => {
      setAttempts((current) => ({ ...current, [id]: 'connecting' }));
      setTimeout(() => {
        if (connectResult === 'connected') {
          setConnected((current) => [...current, id]);
          setAttempts((current) => ({ ...current, [id]: undefined }));
        } else {
          setAttempts((current) => ({ ...current, [id]: connectResult }));
        }
      }, 1500);
    },
    [connectResult]
  );

  const services: FirstRunServicesAdapter = {
    unavailable: settings.noServices,
    featured: selectFeaturedServices(CATALOG, rows),
    attempts,
    anyConnected: connected.length > 0,
    busy: false,
    allServicesCount: ALL_SERVICES_COUNT,
    startConnect,
    checkAgain: (id) => {
      setAttempts((current) => ({ ...current, [id]: 'checking' }));
      setTimeout(() => {
        if (checkAgainFindsGrant) {
          setConnected((current) => [...current, id]);
        }
        setAttempts((current) => ({
          ...current,
          [id]: attemptAfterCheck(checkAgainFindsGrant, 'rechecked'),
        }));
      }, 1000);
    },
    renderAllServices: (onBack) => (
      <BotSettingsScreenView
        available
        busyProviderId={null}
        initialLoading={false}
        onBackPressed={onBack}
        onConnectProvider={(id) => setConnected((current) => [...current, id])}
        onDisconnectProvider={(id) =>
          setConnected((current) => current.filter((entry) => entry !== id))
        }
        onRefresh={noop}
        providers={rows}
        refreshing={false}
        showUnavailableNotice={false}
      />
    ),
  };

  const models: FirstRunModelsAdapter = {
    sections: buildFirstRunModelSections(HOSTED_CONFIG),
    includedName: includedModelName(HOSTED_CONFIG),
    includedModelId: HOSTED_CONFIG.defaultModels.primaryModel,
    onIncludedModel: true,
    botReady,
    renderSubscriptionSignIn: (_provider, handlers) => (
      <FakeSubscriptionSignIn
        onDone={() => handlers.onDone(FAKE_MODELS)}
        onCancel={handlers.onCancel}
      />
    ),
    checkApiKey: (_provider, apiKey) =>
      new Promise((resolve, reject) =>
        setTimeout(
          () =>
            apiKey.length > 8
              ? resolve(FAKE_MODELS)
              : reject(new Error('That key looks too short.')),
          800
        )
      ),
    applyModel: () =>
      new Promise((resolve) =>
        setTimeout(() => resolve(!modelSwitchFails), 1500)
      ),
  };

  return (
    <FirstRunSequence
      setup={{ status }}
      services={services}
      models={models}
      onOpenChat={onRestart}
    />
  );
}

export default {
  Flow: <FlowFixture />,
  'Flow, setup runs late': <FlowFixture readyAfter={15} late />,
  'Flow, sign-in left unfinished': (
    <FlowFixture connectEnds="checking" checkFinds={false} />
  ),
  'Flow, model switch fails': <FlowFixture readyAfter={3} switchFails />,
  '1 Meet your Tlonbot': <MeetFixture />,
  '2 Private by design': <PrivateFixture />,
  '3 Connect': <ConnectFixture />,
  '3 Connect, access sheet': <ConnectFixture sheet />,
  '3 Connect, connected': <ConnectFixture connected />,
  '3 Connect, cancelled': <ConnectFixture attempt="cancelled" />,
  '3 Connect, still checking': <ConnectFixture attempt="checking" />,
  '3 Connect, nothing to connect': <ConnectFixture none />,
  '3 All services': <AllServicesFixture />,
  '4 Model': <ModelFixture />,
  '4 Model, subscription sheet': (
    <ModelFixture sheetFor="subscription:openai" />
  ),
  '4 Model, subscription sheet waiting': (
    <ModelFixture sheetFor="subscription:openai" botReady={false} />
  ),
  '4 Model, API key sheet': <ModelFixture sheetFor="api-key" />,
  '4 API key': <ApiKeyFixture />,
  '5 Make space': <SpaceFixture />,
  'Setup waiting': <SetupFixture />,
};
