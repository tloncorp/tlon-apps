import type { TlawnLLMAuthProvider } from '@tloncorp/api';
import {
  Button,
  Icon,
  LoadingSpinner,
  ParentAgnosticKeyboardAvoidingView,
  Pressable,
  Text,
  useCopy,
  useToast,
} from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, YStack } from 'tamagui';

import {
  type OpenAIAuthState,
  canDismissOpenAIAuth,
  copyOpenAIUserCode,
} from '../../features/settings/bot/openAiSubscription';
import { TextInput } from './Form';
import { ScreenHeader } from './ScreenHeader';

function flowFromState(state: OpenAIAuthState) {
  return 'flow' in state ? state.flow : undefined;
}

export function LLMSubscriptionAuthView({
  state,
  browserError,
  onStart,
  onOpenBrowser,
  onSubmitToken,
  onRetry,
  onCancel,
  showBackButton = true,
  providerLabel = 'OpenAI',
  subscriptionLabel = 'ChatGPT subscription',
  provider = 'openai',
}: {
  state: OpenAIAuthState;
  browserError?: string | null;
  onStart: () => void;
  onOpenBrowser: () => void;
  onSubmitToken: (token: string) => Promise<boolean>;
  onRetry: () => void;
  onCancel: () => void;
  showBackButton?: boolean;
  providerLabel?: string;
  subscriptionLabel?: string;
  provider?: TlawnLLMAuthProvider;
}) {
  const flow = flowFromState(state);
  const error =
    state.phase === 'error'
      ? state.message
      : state.phase === 'active' && state.error
        ? state.error
        : browserError;
  const canGoBack = canDismissOpenAIAuth(state.phase);
  const isSetupToken = provider === 'anthropic';
  const [setupToken, setSetupToken] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);
  const { doCopy, didCopy } = useCopy(flow?.userCode ?? '');
  const showToast = useToast();
  const handleCopyCode = useCallback(async () => {
    await copyOpenAIUserCode(flow?.userCode, doCopy, () => {
      showToast({ message: 'Copied', duration: 1500 });
    });
  }, [doCopy, flow?.userCode, showToast]);
  const handleSubmitToken = useCallback(async () => {
    const token = setupToken.trim();
    if (!token || submittingToken) return;
    setSubmittingToken(true);
    try {
      if (await onSubmitToken(token)) {
        setSetupToken('');
      }
    } finally {
      setSubmittingToken(false);
    }
  }, [onSubmitToken, setupToken, submittingToken]);

  useEffect(() => {
    if (state.phase === 'idle') {
      setSetupToken('');
      setSubmittingToken(false);
    }
  }, [state.phase]);

  return (
    <ParentAgnosticKeyboardAvoidingView contentContainerStyle={{ flex: 1 }}>
      <YStack flex={1} paddingTop="$2xl">
        {showBackButton ? (
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton disabled={!canGoBack} onPress={onCancel} />
          </View>
        ) : null}
        <ScrollView
          flex={1}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <YStack gap="$3xl" padding="$xl" flexGrow={1} justifyContent="center">
            <YStack gap="$xl" alignItems="center">
              <Text size="$label/2xl" fontWeight="600" textAlign="center">
                Connect your {subscriptionLabel}
              </Text>
              <Text size="$body" color="$secondaryText" textAlign="center">
                {isSetupToken
                  ? 'Generate a Claude setup token on a computer with Claude Code, then paste it here.'
                  : `${providerLabel} will ask you to enter a one-time code. Once confirmed, your subscription will be linked.`}
              </Text>
            </YStack>

            {state.phase === 'idle' ? (
              <Button
                preset="primary"
                label={`Connect ${providerLabel}`}
                onPress={onStart}
              />
            ) : null}

            {state.phase === 'starting' ? (
              <YStack alignItems="center" gap="$m">
                <LoadingSpinner />
                <Text size="$label/m" color="$secondaryText">
                  Starting secure sign-in…
                </Text>
              </YStack>
            ) : null}

            {state.phase === 'active' && isSetupToken ? (
              <YStack gap="$2xl">
                <YStack
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$xl"
                  padding="$xl"
                  gap="$s"
                >
                  <Text size="$label/s" color="$secondaryText">
                    Run this command on a computer with Claude Code installed:
                  </Text>
                  <Text size="$label/l" fontFamily="$mono">
                    claude setup-token
                  </Text>
                </YStack>
                <TextInput
                  value={setupToken}
                  placeholder="Paste setup token"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={
                    flow?.status === 'awaiting_token' && !submittingToken
                  }
                  onChangeText={setSetupToken}
                />
                <Button
                  preset="primary"
                  label={submittingToken ? 'Connecting…' : 'Connect'}
                  loading={submittingToken}
                  disabled={
                    !setupToken.trim() ||
                    flow?.status !== 'awaiting_token' ||
                    submittingToken
                  }
                  onPress={() => void handleSubmitToken()}
                />
              </YStack>
            ) : null}

            {state.phase === 'active' && !isSetupToken ? (
              <YStack gap="$2xl">
                {flow?.userCode ? (
                  <Pressable
                    width="100%"
                    testID="OpenAISubscriptionUserCode"
                    accessibilityRole="button"
                    accessibilityLabel={
                      didCopy ? 'Copied' : 'Copy one-time code'
                    }
                    onPress={() => void handleCopyCode()}
                    pressStyle={{ opacity: 0.7 }}
                  >
                    <YStack
                      width="100%"
                      position="relative"
                      borderWidth={1}
                      borderColor="$border"
                      borderRadius="$xl"
                      padding="$xl"
                      alignItems="center"
                      gap="$s"
                    >
                      <Icon
                        type={didCopy ? 'Checkmark' : 'Copy'}
                        color="$secondaryText"
                        customSize={[18, 18]}
                        position="absolute"
                        top="$l"
                        right="$l"
                      />
                      <Text size="$label/s" color="$secondaryText">
                        One-time code
                      </Text>
                      <Text size="$title/l" fontWeight="700">
                        {flow.userCode}
                      </Text>
                    </YStack>
                  </Pressable>
                ) : (
                  <YStack alignItems="center">
                    <LoadingSpinner />
                  </YStack>
                )}
                <Button
                  preset="primary"
                  label={`Open ${providerLabel} sign-in`}
                  disabled={!flow?.verificationUrl}
                  onPress={onOpenBrowser}
                />
              </YStack>
            ) : null}

            {state.phase === 'complete' ? (
              <YStack alignItems="center" gap="$m">
                <LoadingSpinner />
                <Text size="$label/l" color="$positiveActionText">
                  Connected. Loading your models…
                </Text>
              </YStack>
            ) : null}

            {error ? (
              <Text
                size="$label/s"
                color="$negativeActionText"
                textAlign="center"
              >
                {error}
              </Text>
            ) : null}

            {state.phase === 'error' ? (
              <Button preset="primary" label="Try again" onPress={onRetry} />
            ) : null}
          </YStack>
        </ScrollView>
      </YStack>
    </ParentAgnosticKeyboardAvoidingView>
  );
}
