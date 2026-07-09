import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  ConfirmDialog,
  Icon,
  Pressable,
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
  useBotSettingsMutations,
  useBotSettingsQueries,
} from './bot/useBotSettingsData';

type Props = NativeStackScreenProps<RootStackParamList, 'BotApiKeySettings'>;

export function BotApiKeySettingsScreen(props: Props) {
  const { provider: providerId } = props.route.params;
  const isWindowNarrow = useIsWindowNarrow();
  const queries = useBotSettingsQueries();
  const { saveProviderKey, deleteProviderKey } = useBotSettingsMutations();
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

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
  }, [providerId, queries.hostingUserId]);

  const provider = useMemo(
    () => PROVIDER_OPTIONS.find((option) => option.id === providerId),
    [providerId]
  );
  const isConfigured = Boolean(queries.providerConfig.keys?.[providerId]);
  const busy = saveProviderKey.isPending || deleteProviderKey.isPending;

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const handleSave = useCallback(async () => {
    const validation = validateProviderKey(providerId, key);
    if (validation) {
      setValidationError(validation);
      return;
    }
    setValidationError(null);
    try {
      await saveProviderKey.mutateAsync({
        provider: providerId,
        key: key.trim(),
      });
      setKey('');
    } catch {
      // surfaced via saveProviderKey.error below
    }
  }, [providerId, key, saveProviderKey]);

  const handleRemove = useCallback(async () => {
    try {
      await deleteProviderKey.mutateAsync({ provider: providerId });
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
      : null);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title={`${provider.label} API key`}
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

          <Button
            preset="primary"
            label="Save key"
            centered
            disabled={busy || !key.trim()}
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
    </View>
  );
}
