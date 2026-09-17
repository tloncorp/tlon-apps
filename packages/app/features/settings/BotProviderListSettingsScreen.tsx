import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback } from 'react';
import { View, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';
import {
  BotSettingsDivider,
  BotSettingsRow,
  BotSettingsSection,
} from './bot/BotSettingsUI';
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
import { useBotSettingsQueries } from './bot/useBotSettingsData';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'BotProviderListSettings'
>;

export type BotProviderListKind = 'subscriptions' | 'apiKeys';

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
  const isWindowNarrow = useIsWindowNarrow();
  const queries = useBotSettingsQueries();

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

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title={meta.title}
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <BotSettingsSection subtitle={meta.description}>
          {kind === 'subscriptions'
            ? subscriptionProviders.map((provider, index) => (
                <YStack key={`${provider.providerId}:subscription`}>
                  {index > 0 ? <BotSettingsDivider /> : null}
                  <BotSettingsRow
                    label={subscriptionProviderLabel(provider.providerId)}
                    value={provider.summary}
                    valueColor={provider.connected ? '$primaryText' : undefined}
                    icon="Link"
                    disabled={!queries.botReady || !providerKeysReady}
                    onPress={() =>
                      navigate('BotOpenAISubscription', {
                        provider: provider.providerId,
                      })
                    }
                  />
                </YStack>
              ))
            : apiKeyProviders.map((option, index) => (
                <YStack key={option.id}>
                  {index > 0 ? <BotSettingsDivider /> : null}
                  <BotSettingsRow
                    label={option.label}
                    value={
                      queries.providerConfig.keys?.[option.id]
                        ? safeKeySummary(queries.providerConfig, option.id)
                        : 'Add key'
                    }
                    icon="Lock"
                    disabled={!providerKeysReady}
                    onPress={() =>
                      navigate('BotApiKeySettings', { provider: option.id })
                    }
                  />
                </YStack>
              ))}
        </BotSettingsSection>
      </SettingsContentScrollView>
    </View>
  );
}
