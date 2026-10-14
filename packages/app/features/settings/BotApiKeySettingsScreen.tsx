import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConfirmDialog, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RootStackParamList } from '../../navigation/types';
import {
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import {
  PROVIDER_OPTIONS,
  isSubscriptionProvider,
  subscriptionLabel,
} from './bot/constants';
import {
  getErrorMessage,
  safeKeySummary,
  validateProviderKey,
} from './bot/helpers';
import {
  getLLMAuthProviderStatus,
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
  const { saveProviderKey, deleteProviderKey, disconnectLLMSubscription } =
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
  const supportsSubscription = isSubscriptionProvider(providerId);
  const subscriptionName = supportsSubscription
    ? subscriptionLabel(providerId)
    : null;
  const subscriptionConnected =
    supportsSubscription &&
    isLLMAuthProviderConnected(
      getLLMAuthProviderStatus(queries.llmAuthStatusQuery.data, providerId)
        ?.status
    );
  const subscriptionStatusKnown =
    !supportsSubscription || queries.llmAuthStatusQuery.data !== undefined;
  const subscriptionStatusError =
    supportsSubscription &&
    !subscriptionStatusKnown &&
    queries.llmAuthStatusQuery.isError;
  const busy =
    saveProviderKey.isPending ||
    deleteProviderKey.isPending ||
    disconnectLLMSubscription.isPending;

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
    // can leave both credential modes configured for the provider.
    if (!subscriptionStatusKnown) {
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
        subscriptionConnected,
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
    subscriptionStatusKnown,
    providerId,
    saveKey,
    subscriptionConnected,
  ]);

  const handleSwitch = useCallback(async () => {
    try {
      await saveKey();
      if (supportsSubscription) {
        await disconnectLLMSubscription.mutateAsync(providerId);
      }
      setKey('');
      setConfirmSwitch(false);
    } catch {
      // surfaced via mutation errors below
    }
  }, [disconnectLLMSubscription, providerId, saveKey, supportsSubscription]);

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
      ? (getErrorMessage(saveProviderKey.error) ?? 'Failed to save API key.')
      : null) ??
    (deleteProviderKey.error
      ? (getErrorMessage(deleteProviderKey.error) ??
        'Failed to delete provider key.')
      : null) ??
    (disconnectLLMSubscription.error
      ? (getErrorMessage(disconnectLLMSubscription.error) ??
        `Failed to disconnect the ${subscriptionName ?? 'subscription'}.`)
      : null);

  const subscriptionStatusText = subscriptionStatusError
    ? (getErrorMessage(queries.llmAuthStatusQuery.error) ??
      `Could not check your ${subscriptionName}.`)
    : `Checking your ${subscriptionName}…`;

  const sections: SettingsSectionModel[] = [
    {
      key: 'key',
      title: 'API key',
      footer:
        errorMessage ??
        (isConfigured
          ? `Current key: ${safeKeySummary(queries.providerConfig, providerId)}`
          : `Add a key to use ${provider.label} models.`),
      rows: [
        {
          key: 'key',
          title: 'API key',
          disabled: busy,
          textField: {
            value: key,
            onChangeText: (value) => {
              setKey(value);
              setValidationError(null);
            },
            placeholder: isConfigured
              ? 'Enter replacement key'
              : 'Enter API key',
            secure: !showKey,
          },
          testID: 'BotApiKeyInput',
        },
        {
          key: 'show',
          title: 'Show key',
          toggle: { value: showKey, onValueChange: setShowKey },
        },
      ],
    },
    ...(subscriptionStatusKnown
      ? []
      : [
          {
            key: 'subscription',
            rows: subscriptionStatusError
              ? [
                  {
                    key: 'retry',
                    title: 'Try again',
                    action: true,
                    disabled: queries.llmAuthStatusQuery.isFetching,
                    onPress: () => void queries.llmAuthStatusQuery.refetch(),
                  },
                ]
              : [{ key: 'checking', title: subscriptionStatusText }],
            footer: subscriptionStatusError
              ? subscriptionStatusText
              : undefined,
          },
        ]),
    ...(isConfigured
      ? [
          {
            key: 'remove',
            rows: [
              {
                key: 'remove',
                title: 'Remove key',
                action: true,
                destructive: true,
                disabled: busy,
                onPress: () => setConfirmRemove(true),
                testID: 'BotApiKeyRemoveButton',
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <SettingsListScreenView
      title={`${provider.label} API key`}
      sections={sections}
      onBackPressed={handleBack}
      useHorizontalTitleLayout={!isWindowNarrow}
      rightActions={[
        {
          id: 'BotApiKeySaveButton',
          text: saveProviderKey.isPending ? 'Saving…' : 'Save',
          tint: '$positiveActionText',
          disabled: busy || !key.trim() || !subscriptionStatusKnown,
          onPress: handleSave,
          testID: 'BotApiKeySaveButton',
        },
      ]}
    >
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
        title={`Replace the ${subscriptionName}?`}
        description={`${subscriptionName} access and ${provider?.label ?? providerId} API-key access are alternatives. Saving this key will disconnect the ${subscriptionName}.`}
        confirmText="Replace and save"
        onConfirm={handleSwitch}
      />
    </SettingsListScreenView>
  );
}
