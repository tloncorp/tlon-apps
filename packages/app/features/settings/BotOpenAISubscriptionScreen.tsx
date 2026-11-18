import { usePreventRemove } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, ConfirmDialog, LoadingSpinner, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import {
  SettingsListScreenView,
  useSettingsListHeaderColor,
  useSettingsListSurfaces,
} from '../../ui/components/SettingsList';
import { LLMSubscriptionAuthView, ScreenHeader } from '../../ui';
import {
  providerLabel,
  subscriptionLabel,
  subscriptionProviderLabel,
} from './bot/constants';
import { getErrorMessage, getSubscriptionStatusState } from './bot/helpers';
import {
  canDismissOpenAIAuth,
  getLLMAuthProviderStatus,
  getOpenAICredentialSwitch,
  isLLMAuthProviderConnected,
} from './bot/openAiSubscription';
import {
  useBotSettingsMutations,
  useBotSettingsQueries,
} from './bot/useBotSettingsData';
import { useOpenAISubscriptionAuth } from './bot/useOpenAISubscriptionAuth';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'BotOpenAISubscription'
>;

export function BotOpenAISubscriptionScreen(props: Props) {
  const { page: settingsPage } = useSettingsListSurfaces();
  const settingsHeaderColor = useSettingsListHeaderColor();
  const providerId = props.route.params?.provider ?? 'openai';
  const providerName = providerLabel(providerId);
  const subscriptionName = subscriptionLabel(providerId);
  const queries = useBotSettingsQueries();
  const { deleteProviderKey, disconnectLLMSubscription } =
    useBotSettingsMutations();
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const providerStatus = getLLMAuthProviderStatus(
    queries.llmAuthStatusQuery.data,
    providerId
  );
  const connected = isLLMAuthProviderConnected(providerStatus?.status);
  const hasApiKey = Boolean(queries.providerConfig.keys?.[providerId]);
  const subscriptionStatus = getSubscriptionStatusState(
    queries.llmAuthStatusQuery
  );
  const statusUnavailable = subscriptionStatus === 'unavailable';

  const { navigation } = props;
  const openModelPicker = useCallback(() => {
    navigation.navigate('BotModels', undefined, { pop: true });
    navigation.navigate('BotModelSettings', { mode: 'default' });
  }, [navigation]);

  const handleComplete = useCallback(async () => {
    if (hasApiKey) {
      await deleteProviderKey.mutateAsync({ provider: providerId });
    }
    await queries.llmAuthStatusQuery.refetch();
    if (providerId !== 'openai') {
      openModelPicker();
    }
  }, [
    deleteProviderKey,
    hasApiKey,
    openModelPicker,
    providerId,
    queries.llmAuthStatusQuery,
  ]);

  const auth = useOpenAISubscriptionAuth({
    ship: queries.ship,
    provider: providerId,
    onComplete: handleComplete,
  });

  usePreventRemove(!canDismissOpenAIAuth(auth.state.phase), () => undefined);

  const beginConnection = useCallback(() => {
    const credentialSwitch = getOpenAICredentialSwitch(
      { hasApiKey, subscriptionConnected: connected },
      'subscription'
    );
    if (credentialSwitch.remove === 'api-key') {
      setConfirmSwitch(true);
      return;
    }
    void auth.start();
  }, [auth, connected, hasApiKey]);

  const startedRef = useRef(false);
  const { start } = auth;
  useEffect(() => {
    if (
      providerId !== 'openai' ||
      startedRef.current ||
      !queries.ship ||
      !queries.botReady ||
      !queries.providerConfigQuery.isSuccess ||
      subscriptionStatus !== 'known'
    )
      return;
    startedRef.current = true;
    if (!connected && !hasApiKey) {
      void start();
    }
  }, [
    start,
    connected,
    hasApiKey,
    providerId,
    queries.botReady,
    queries.providerConfigQuery.isSuccess,
    queries.ship,
    subscriptionStatus,
  ]);

  const handleSwitch = useCallback(async () => {
    try {
      setConfirmSwitch(false);
      await auth.start();
    } catch {
      // The mutation error is rendered below.
    }
  }, [auth]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectLLMSubscription.mutateAsync(providerId);
      setConfirmDisconnect(false);
      auth.dismiss();
    } catch {
      // The mutation error is rendered below.
    }
  }, [auth, disconnectLLMSubscription, providerId]);

  const mutationError = deleteProviderKey.error
    ? (getErrorMessage(deleteProviderKey.error) ??
      `Failed to remove the ${providerName} API key.`)
    : disconnectLLMSubscription.error
      ? (getErrorMessage(disconnectLLMSubscription.error) ??
        `Failed to disconnect the ${subscriptionName}.`)
      : null;

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirmSwitch}
        onOpenChange={setConfirmSwitch}
        destructive
        title={`Replace the ${providerName} API key?`}
        description={`${providerName} API-key access and ${subscriptionName} access are alternatives. The saved API key will be removed after your subscription connects.`}
        confirmText="Replace and connect"
        onConfirm={handleSwitch}
      />
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        destructive
        title={`Disconnect ${subscriptionName}?`}
        description="Tlonbot will no longer be able to use models from this subscription."
        confirmText="Disconnect"
        onConfirm={handleDisconnect}
      />
    </>
  );

  if (
    subscriptionStatus === 'known' &&
    connected &&
    auth.state.phase === 'idle'
  ) {
    return (
      <SettingsListScreenView
        title={subscriptionName}
        onBackPressed={() => props.navigation.goBack()}
        sections={[
          {
            key: 'status',
            footer: `Tlonbot can use models included with your ${subscriptionName}.`,
            rows: [
              {
                key: 'status',
                title: subscriptionProviderLabel(providerId),
                leading: { kind: 'icon', icon: 'Link' },
                value:
                  providerStatus?.status === 'expiring'
                    ? 'Expiring soon'
                    : 'Connected',
              },
            ],
          },
          {
            key: 'disconnect',
            footer: mutationError ?? undefined,
            rows: [
              {
                key: 'disconnect',
                title: 'Disconnect',
                action: true,
                destructive: true,
                disabled: disconnectLLMSubscription.isPending,
                onPress: () => setConfirmDisconnect(true),
              },
            ],
          },
        ]}
      >
        {dialogs}
      </SettingsListScreenView>
    );
  }

  return (
    <View flex={1} backgroundColor={settingsPage}>
      <ScreenHeader
        backgroundColor={settingsHeaderColor}
        borderBottom
        backAction={() => {
          auth.dismiss();
          props.navigation.goBack();
        }}
        backDisabled={!canDismissOpenAIAuth(auth.state.phase)}
        title={subscriptionName}
        placement="navigation"
      />
      {subscriptionStatus === 'checking' ? (
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$m">
          <LoadingSpinner />
          <Text size="$label/m" color="$secondaryText">
            Checking {providerName} connection…
          </Text>
        </YStack>
      ) : statusUnavailable ? (
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap="$l"
          padding="$xl"
        >
          <Text size="$label/l" textAlign="center">
            Could not check your {subscriptionName}.
          </Text>
          <Text size="$label/s" color="$secondaryText" textAlign="center">
            {getErrorMessage(queries.llmAuthStatusQuery.error) ??
              'Check your connection and try again.'}
          </Text>
          <Button
            preset="primary"
            label="Try again"
            loading={queries.llmAuthStatusQuery.isFetching}
            onPress={() => void queries.llmAuthStatusQuery.refetch()}
          />
        </YStack>
      ) : (
        <YStack flex={1}>
          <LLMSubscriptionAuthView
            state={auth.state}
            browserError={auth.browserError ?? mutationError}
            onStart={beginConnection}
            onOpenBrowser={auth.openVerificationUrl}
            onContinue={openModelPicker}
            onSubmitToken={auth.completeToken}
            onRetry={() => void auth.restart()}
            showBackButton={false}
            onCancel={() => {
              auth.dismiss();
              props.navigation.goBack();
            }}
            providerLabel={providerName}
            subscriptionLabel={subscriptionName}
            provider={providerId}
          />
        </YStack>
      )}
      {dialogs}
    </View>
  );
}
