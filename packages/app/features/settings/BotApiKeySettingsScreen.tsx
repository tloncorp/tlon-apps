import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  ConfirmDialog,
  Icon,
  Pressable,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import {
  Field,
  ScreenHeader,
  SettingsContentScrollView,
  TextInput,
} from '../../ui';
import { BotSettingsSection } from './bot/BotSettingsUI';
import { PROVIDER_OPTIONS } from './bot/constants';
import {
  getErrorMessage,
  safeKeySummary,
  validateProviderKey,
} from './bot/helpers';
import {
  getOpenAIAuthStatus,
  getOpenAICredentialSwitch,
  isLLMAuthProviderConnected,
} from './bot/openAiSubscription';
import {
  useBotSettingsMutations,
  useBotSettingsQueries,
} from './bot/useBotSettingsData';

type Props = NativeStackScreenProps<RootStackParamList, 'BotApiKeySettings'>;

export function BotApiKeySettingsScreen(props: Props) {
  const { provider: providerId } = props.route.params;
  const isWindowNarrow = useIsWindowNarrow();
  const queries = useBotSettingsQueries();
  const { saveProviderKey, deleteProviderKey, disconnectOpenAISubscription } =
    useBotSettingsMutations();
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  // The desktop settings drawer keeps this screen mounted across provider
  // switches, so clear the pasted key and related state when the provider
  // param changes — an unsaved key must never carry over to (and be saved
  // against) a different provider. Also reset on a hosting-account switch: the
  // save/remove mutations rebind to the new hostingUserId, so a stale pasted
  // key or open remove dialog must not act on the new account.
  useEffect(() => {
    setKey('');
    setShowKey(false);
    setValidationError(null);
    setConfirmRemove(false);
    setConfirmSwitch(false);
  }, [providerId, queries.hostingUserId]);

  const provider = useMemo(
    () => PROVIDER_OPTIONS.find((option) => option.id === providerId),
    [providerId]
  );
  const isConfigured = Boolean(queries.providerConfig.keys?.[providerId]);
  const subscriptionConnected = isLLMAuthProviderConnected(
    getOpenAIAuthStatus(queries.llmAuthStatusQuery.data)?.status
  );
  const openAIStatusKnown =
    providerId !== 'openai' || queries.llmAuthStatusQuery.data !== undefined;
  const openAIStatusError =
    providerId === 'openai' &&
    !openAIStatusKnown &&
    queries.llmAuthStatusQuery.isError;
  const busy =
    saveProviderKey.isPending ||
    deleteProviderKey.isPending ||
    disconnectOpenAISubscription.isPending;

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const saveKey = useCallback(async () => {
    await saveProviderKey.mutateAsync({
      provider: providerId,
      key: key.trim(),
    });
  }, [key, providerId, saveProviderKey]);

  const handleSave = useCallback(async () => {
    // Do not infer that the subscription is disconnected while its status is
    // loading or unavailable. Otherwise this bypasses the replacement flow and
    // can leave both OpenAI credential modes configured.
    if (!openAIStatusKnown) {
      return;
    }
    const validation = validateProviderKey(providerId, key);
    if (validation) {
      setValidationError(validation);
      return;
    }
    setValidationError(null);
    const credentialSwitch = getOpenAICredentialSwitch(
      {
        hasApiKey: isConfigured,
        subscriptionConnected: providerId === 'openai' && subscriptionConnected,
      },
      'api-key'
    );
    if (credentialSwitch.remove === 'subscription') {
      setConfirmSwitch(true);
      return;
    }
    try {
      await saveKey();
      setKey('');
    } catch {
      // surfaced via saveProviderKey.error below
    }
  }, [
    isConfigured,
    key,
    openAIStatusKnown,
    providerId,
    saveKey,
    subscriptionConnected,
  ]);

  const handleSwitch = useCallback(async () => {
    try {
      await saveKey();
      await disconnectOpenAISubscription.mutateAsync();
      setKey('');
      setConfirmSwitch(false);
    } catch {
      // surfaced via mutation errors below
    }
  }, [disconnectOpenAISubscription, saveKey]);

  const handleRemove = useCallback(async () => {
    try {
      await deleteProviderKey.mutateAsync({ provider: providerId });
      // Clear any typed replacement key and close the dialog: otherwise a
      // just-removed secret stays visible and Save stays enabled, so a stray tap
      // could immediately write the credential back.
      setKey('');
      setShowKey(false);
      setValidationError(null);
      setConfirmRemove(false);
    } catch {
      // surfaced via deleteProviderKey.error below
    }
  }, [providerId, deleteProviderKey]);

  if (!provider) {
    return null;
  }

  const errorMessage =
    validationError ??
    (saveProviderKey.error
      ? getErrorMessage(saveProviderKey.error) ?? 'Failed to save API key.'
      : null) ??
    (deleteProviderKey.error
      ? getErrorMessage(deleteProviderKey.error) ??
        'Failed to delete provider key.'
      : null) ??
    (disconnectOpenAISubscription.error
      ? getErrorMessage(disconnectOpenAISubscription.error) ??
        'Failed to disconnect the ChatGPT subscription.'
      : null);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title={`${provider.label} API key`}
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$2xl" paddingBottom="$2xl">
          <BotSettingsSection
            description={
              isConfigured
                ? `Current key: ${safeKeySummary(queries.providerConfig, providerId)}`
                : `Add a key to use ${provider.label} models.`
            }
          >
            <YStack padding="$l">
              <Field label="API key" error={errorMessage ?? undefined}>
                <XStack alignItems="center" gap="$m">
                  <View flex={1}>
                    <TextInput
                      value={key}
                      placeholder={
                        isConfigured ? 'Enter replacement key' : 'Enter API key'
                      }
                      secureTextEntry={!showKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                      onChangeText={(value) => {
                        setKey(value);
                        setValidationError(null);
                      }}
                    />
                  </View>
                  <Pressable onPress={() => setShowKey((value) => !value)}>
                    <Icon
                      type={showKey ? 'EyeClosed' : 'EyeOpen'}
                      size="$m"
                      color="$secondaryText"
                    />
                  </Pressable>
                </XStack>
              </Field>
            </YStack>
          </BotSettingsSection>

          {!openAIStatusKnown ? (
            <YStack gap="$m">
              <Text
                size="$label/s"
                color={
                  openAIStatusError ? '$negativeActionText' : '$secondaryText'
                }
              >
                {openAIStatusError
                  ? getErrorMessage(queries.llmAuthStatusQuery.error) ??
                    'Could not check your ChatGPT subscription.'
                  : 'Checking your ChatGPT subscription…'}
              </Text>
              {openAIStatusError ? (
                <Button
                  preset="secondary"
                  label="Try again"
                  centered
                  loading={queries.llmAuthStatusQuery.isFetching}
                  onPress={() => void queries.llmAuthStatusQuery.refetch()}
                />
              ) : null}
            </YStack>
          ) : null}

          <Button
            preset="primary"
            label="Save key"
            centered
            disabled={busy || !key.trim() || !openAIStatusKnown}
            loading={saveProviderKey.isPending}
            onPress={handleSave}
          />
          {isConfigured ? (
            <Button
              preset="destructive"
              label="Remove key"
              centered
              disabled={busy}
              loading={deleteProviderKey.isPending}
              onPress={() => setConfirmRemove(true)}
            />
          ) : null}
        </YStack>
      </SettingsContentScrollView>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        destructive
        title={`Remove ${provider.label} API key?`}
        description="Tlonbot will stop using custom models from this provider."
        confirmText="Remove"
        onConfirm={handleRemove}
      />
      <ConfirmDialog
        open={confirmSwitch}
        onOpenChange={setConfirmSwitch}
        destructive
        title="Replace the ChatGPT subscription?"
        description="ChatGPT subscription access and OpenAI API-key access are alternatives. Saving this key will disconnect the ChatGPT subscription."
        confirmText="Replace and save"
        onConfirm={handleSwitch}
      />
    </View>
  );
}
