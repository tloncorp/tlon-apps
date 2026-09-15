import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useFixtureInput } from 'react-cosmos/client';

import type {
  TlawnConfig,
  TlawnOpenRouterZdrEndpoint,
  TlawnProviderConfigInfo,
  TlawnProviderModel,
} from '@tloncorp/api';
import { FixtureWrapper } from '@tloncorp/app/fixtures/FixtureWrapper';
import { BotModelSettingsScreen } from '@tloncorp/app/features/settings/BotModelSettingsScreen';
import { BotSettingsScreen } from '@tloncorp/app/features/settings/BotSettingsScreen';
import {
  resetBotSettingsDraft,
  useBotSettingsDraftStore,
} from '@tloncorp/app/features/settings/bot/useBotSettingsDraft';
import { ShipProvider } from '@tloncorp/app/contexts/ship';
import { queryClient } from '@tloncorp/shared';

// Keep hosting queries disabled in Cosmos. Their cached data still renders,
// but an empty user ID prevents scheduled refetches from reaching the API.
const fixtureUserId = '';
const fixtureShip = 'zod';

const providerModels: TlawnProviderModel[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    pricing: { prompt: '0.000003', completion: '0.000015' },
  },
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    pricing: { prompt: '0.00000125', completion: '0.00001' },
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    pricing: { prompt: '0.00000125', completion: '0.00001' },
  },
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    pricing: { prompt: '0.00000025', completion: '0.00000038' },
  },
  {
    id: 'mistralai/mistral-small-3.2-24b-instruct',
    name: 'Mistral Small 3.2',
    pricing: { prompt: '0.0000001', completion: '0.0000003' },
  },
];

const zdrEndpoints: TlawnOpenRouterZdrEndpoint[] = [
  {
    modelId: 'anthropic/claude-sonnet-4.5',
    providerName: 'Anthropic',
    endpointName: 'Anthropic',
    promptPrice: '0.000003',
    completionPrice: '0.000015',
  },
  {
    modelId: 'openai/gpt-5.1',
    providerName: 'OpenAI',
    endpointName: 'OpenAI',
    promptPrice: '0.00000125',
    completionPrice: '0.00001',
  },
  {
    modelId: 'mistralai/mistral-small-3.2-24b-instruct',
    providerName: 'Mistral',
    endpointName: 'Mistral',
    promptPrice: '0.0000001',
    completionPrice: '0.0000003',
  },
];

const botConfig: TlawnConfig = {
  dmAllowlist: [],
  defaultAuthorizedShips: [],
  channelRules: {},
  groupChannels: [],
  groupInviteAllowlist: [],
  autoAcceptDmInvites: false,
  autoDiscoverChannels: false,
};

type ScreenProps = ComponentProps<typeof BotModelSettingsScreen>;
type SettingsScreenProps = ComponentProps<typeof BotSettingsScreen>;

const navigation = {
  goBack: () => undefined,
} as ScreenProps['navigation'];

const route = {
  key: 'BotModelSettingsFixture',
  name: 'BotModelSettings' as const,
  params: { mode: 'default' as const },
} as ScreenProps['route'];

const settingsNavigation = {
  goBack: () => undefined,
  navigate: () => undefined,
} as unknown as SettingsScreenProps['navigation'];

const settingsRoute = {
  key: 'BotSettingsFixture',
  name: 'BotSettings' as const,
} as SettingsScreenProps['route'];

function seedFixtureData({
  zdr,
  endpoints,
  provider = 'openrouter',
}: {
  zdr: boolean;
  endpoints: TlawnOpenRouterZdrEndpoint[];
  provider?: 'basic' | 'openrouter';
}) {
  const selectedModel =
    provider === 'basic'
      ? 'openai/gpt-5.6-luna'
      : 'anthropic/claude-sonnet-4.5';
  const providerConfig: TlawnProviderConfigInfo = {
    keys:
      provider === 'openrouter' ? { openrouter: 'fixture-key-never-sent' } : {},
    defaultKeys: provider === 'basic' ? { basic: { key: 'included' } } : {},
    models: [
      {
        provider,
        model: selectedModel,
        primary: true,
        zdr,
      },
    ],
  };

  queryClient.setQueryData(['hostingUserId'], fixtureUserId);
  queryClient.setQueryData(['tlonbot', 'ready', fixtureShip], true);
  queryClient.setQueryData(
    ['tlonbot', 'provider-config', fixtureUserId],
    providerConfig
  );
  queryClient.setQueryData(['tlonbot', 'settings', fixtureShip], botConfig);
  queryClient.setQueryData(['tlonbot', 'nickname', fixtureShip], 'Cosmos Bot');
  queryClient.setQueryData(['tlonbot', 'avatar', fixtureShip], null);
  queryClient.setQueryData(['tlonbot', 'channels', fixtureShip], []);
  queryClient.setQueryData(['tlonbot', 'moon', fixtureShip], null);
  queryClient.setQueryData(['tlonbot', 'oauth-status', fixtureShip], {
    available: true,
    grants: [],
  });
  queryClient.setQueryData(['tlonbot', 'oauth-providers'], []);
  queryClient.setQueryData(['tlonbot', 'llm-auth-status', fixtureShip], {
    ts: Date.now(),
    providers: [],
  });
  queryClient.setQueryData(
    ['tlonbot', 'provider-models', fixtureUserId, 'openrouter'],
    providerModels
  );
  queryClient.setQueryData(
    ['tlonbot', 'openrouter-recommended-models', fixtureUserId],
    ['anthropic/claude-sonnet-4.5', 'openai/gpt-5.1']
  );
  queryClient.setQueryData(
    ['tlonbot', 'openrouter-zdr-endpoints', fixtureUserId],
    endpoints
  );

  resetBotSettingsDraft();
  useBotSettingsDraftStore.getState().syncServerValues(fixtureShip, {
    nickname: 'Cosmos Bot',
    model: {
      provider,
      model: selectedModel,
      zdr,
      fallbacks: [],
    },
    chat: {
      dmAllowlist: '',
      defaultAuthorizedShips: '',
      groupInviteAllowlist: '',
      autoAcceptDmInvites: false,
      autoDiscoverChannels: false,
      channelRuleDrafts: {},
    },
  });
}

function useSeededFixture({
  zdr,
  endpoints = zdrEndpoints,
  provider = 'openrouter',
}: {
  zdr: boolean;
  endpoints?: TlawnOpenRouterZdrEndpoint[];
  provider?: 'basic' | 'openrouter';
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const previousShip = window.our;
    const previousAlert = Alert.alert;
    // The real screen rejects a missing hosting session. This fixture keeps the
    // user ID empty to disable network queries, so suppress that fixture-only
    // alert without writing mock credentials into secure storage.
    Alert.alert = () => undefined;
    window.our = `~${fixtureShip}`;
    seedFixtureData({ zdr, endpoints, provider });
    setReady(true);

    return () => {
      Alert.alert = previousAlert;
      window.our = previousShip;
      resetBotSettingsDraft();
      queryClient.removeQueries({ queryKey: ['tlonbot'] });
    };
  }, [endpoints, provider, zdr]);

  return ready;
}

function BotModelSettingsFixture({
  zdr = false,
  endpoints = zdrEndpoints,
}: {
  zdr?: boolean;
  endpoints?: TlawnOpenRouterZdrEndpoint[];
}) {
  const ready = useSeededFixture({ zdr, endpoints });

  if (!ready) return null;

  return (
    <ShipProvider
      initialShipInfo={{
        authType: 'hosted',
        ship: fixtureShip,
        shipUrl: 'https://zod.test',
        authCookie: 'fixture',
        needsSplashSequence: false,
      }}
    >
      <FixtureWrapper fillWidth fillHeight safeArea>
        <BotModelSettingsScreen navigation={navigation} route={route} />
      </FixtureWrapper>
    </ShipProvider>
  );
}

function BasicZdrSettingsFixture({ zdr = false }: { zdr?: boolean }) {
  const [paddingVertical] = useFixtureInput('ZDR row vertical padding', 32);
  const [descriptionGap] = useFixtureInput('ZDR title/subtitle gap', 12);
  const ready = useSeededFixture({ zdr, provider: 'basic' });

  if (!ready) return null;

  return (
    <ShipProvider
      initialShipInfo={{
        authType: 'hosted',
        ship: fixtureShip,
        shipUrl: 'https://zod.test',
        authCookie: 'fixture',
        needsSplashSequence: false,
      }}
    >
      <FixtureWrapper fillWidth fillHeight safeArea>
        <BotSettingsScreen
          navigation={settingsNavigation}
          route={settingsRoute}
          zdrRowLayout={{ descriptionGap, paddingVertical }}
        />
      </FixtureWrapper>
    </ShipProvider>
  );
}

export default {
  'Basic — ZDR off': <BasicZdrSettingsFixture />,
  'Basic — ZDR on': <BasicZdrSettingsFixture zdr />,
  'Eligible ZDR models': <BotModelSettingsFixture />,
  'ZDR enabled': <BotModelSettingsFixture zdr />,
  'No eligible endpoints': <BotModelSettingsFixture endpoints={[]} />,
};
