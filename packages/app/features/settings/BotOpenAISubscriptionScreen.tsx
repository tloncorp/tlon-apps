import { usePreventRemove } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, ConfirmDialog, LoadingSpinner, Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { View, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import {
  LLMSubscriptionAuthView,
  ScreenHeader,
  SettingsContentScrollView,
} from '../../ui';
import { BotSettingsSection } from './bot/BotSettingsUI';
import { providerLabel, subscriptionLabel } from './bot/constants';
import { getErrorMessage } from './bot/helpers';
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
  const statusUnavailable =
    queries.llmAuthStatusQuery.isError &&
    queries.llmAuthStatusQuery.data === undefined;

  const handleComplete = useCallback(async () => {
    if (hasApiKey) {
      await deleteProviderKey.mutateAsync({ provider: providerId });
    }
    await queries.llmAuthStatusQuery.refetch();
    props.navigation.navigate('BotModelSettings', { mode: 'default' });
  }, [
    deleteProviderKey,
    hasApiKey,
    providerId,
    props.navigation,
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

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={() => {
          auth.dismiss();
          props.navigation.goBack();
        }}
        backDisabled={!canDismissOpenAIAuth(auth.state.phase)}
        title={subscriptionName}
      />
      {queries.llmAuthStatusQuery.isLoading ? (
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
      ) : connected && auth.state.phase === 'idle' ? (
        <SettingsContentScrollView
          paddingHorizontal="$l"
          paddingTop="$l"
          safeAreaBottomOffset={24}
        >
          <YStack gap="$2xl" paddingBottom="$2xl">
            <BotSettingsSection
              title="Connected"
              description={`Tlonbot can use models included with your ${subscriptionName}.`}
            >
              <YStack padding="$l" gap="$s">
                <Text size="$label/m">{subscriptionName}</Text>
                <Text size="$label/s" color="$secondaryText">
                  Status: {providerStatus?.status ?? 'connected'}
                </Text>
              </YStack>
            </BotSettingsSection>
            {mutationError ? (
              <Text size="$label/s" color="$negativeActionText">
                {mutationError}
              </Text>
            ) : null}
            <Button
              preset="primary"
              label="Choose model"
              onPress={() =>
                props.navigation.navigate('BotModelSettings', {
                  mode: 'default',
                })
              }
            />
            <Button
              preset="destructive"
              label="Disconnect subscription"
              loading={disconnectLLMSubscription.isPending}
              disabled={disconnectLLMSubscription.isPending}
              onPress={() => setConfirmDisconnect(true)}
            />
          </YStack>
        </SettingsContentScrollView>
      ) : (
        <YStack flex={1}>
          <LLMSubscriptionAuthView
            state={auth.state}
            browserError={auth.browserError ?? mutationError}
            onStart={beginConnection}
            onOpenBrowser={() => void auth.openVerificationUrl()}
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
    </View>
  );
}
