import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';
import {
  type SettingsRowModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import {
  BASIC_PROVIDER_ID,
  PROVIDER_OPTIONS,
  SUBSCRIPTION_PROVIDERS,
  subscriptionProviderLabel,
} from './bot/constants';
import { safeKeySummary } from './bot/helpers';
import {
  getLLMAuthProviderStatus,
  isLLMAuthProviderConnected,
} from './bot/openAiSubscription';
import { useBotSettingsDraftStore } from './bot/botSettingsDraftStore';
import { useBotSettingsQueries } from './bot/useBotSettingsData';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'BotProviderListSettings'
>;

type BotProviderListKind = 'subscriptions' | 'apiKeys';

const listMeta: Record<
  BotProviderListKind,
  { title: string; description: string }
> = {
  subscriptions: {
    title: 'Provider subscriptions',
    description: 'Connect an existing AI subscription to your Tlonbot.',
  },
  apiKeys: {
    title: 'API keys',
    description: 'Use a developer API key with your Tlonbot.',
  },
};

export function BotProviderListSettingsScreen(props: Props) {
  const { kind } = props.route.params;
  const meta = listMeta[kind];
  const queries = useBotSettingsQueries();
  const applying = useBotSettingsDraftStore((state) => state.applying);

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const navigate = props.navigation.navigate;
  // The provider-key endpoint is user-level and stays usable even when the bot's
  // own config queries are erroring (e.g. the gateway can't start until a bad
  // key is replaced), so these rows gate on provider-config readiness alone.
  const providerKeysReady = queries.providerConfigQuery.isSuccess;

  const subscriptionProviders = SUBSCRIPTION_PROVIDERS.map((providerId) => {
    const status = getLLMAuthProviderStatus(
      queries.llmAuthStatusQuery.data,
      providerId
    );
    const connected = isLLMAuthProviderConnected(status?.status);
    const summary = queries.llmAuthStatusQuery.isLoading
      ? 'Checking…'
      : queries.llmAuthStatusQuery.isError &&
          queries.llmAuthStatusQuery.data === undefined
        ? 'Unavailable'
        : connected
          ? 'Active'
          : 'Add';
    return { providerId, connected, summary };
  }).sort((left, right) => Number(right.connected) - Number(left.connected));

  const apiKeyProviders = PROVIDER_OPTIONS.filter(
    (option) => option.id !== BASIC_PROVIDER_ID
  ).sort((left, right) => {
    const leftConfigured = Boolean(queries.providerConfig.keys?.[left.id]);
    const rightConfigured = Boolean(queries.providerConfig.keys?.[right.id]);
    return Number(rightConfigured) - Number(leftConfigured);
  });

  const rows: SettingsRowModel[] =
    kind === 'subscriptions'
      ? subscriptionProviders.map((provider) => ({
          key: `${provider.providerId}:subscription`,
          title: subscriptionProviderLabel(provider.providerId),
          value: provider.summary,
          leading: { kind: 'icon', icon: 'Link' },
          disabled: applying || !queries.botReady || !providerKeysReady,
          onPress: () =>
            navigate('BotOpenAISubscription', {
              provider: provider.providerId,
            }),
        }))
      : apiKeyProviders.map((option) => ({
          key: option.id,
          title: option.label,
          value: queries.providerConfig.keys?.[option.id]
            ? safeKeySummary(queries.providerConfig, option.id)
            : 'Add key',
          leading: { kind: 'icon', icon: 'Lock' },
          disabled: applying || !providerKeysReady,
          onPress: () => navigate('BotApiKeySettings', { provider: option.id }),
        }));

  return (
    <SettingsListScreenView
      title={meta.title}
      sections={[{ key: kind, footer: meta.description, rows }]}
      onBackPressed={handleBack}
    />
  );
}
