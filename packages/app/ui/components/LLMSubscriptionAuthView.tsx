import type { TlawnLLMAuthProvider } from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import {
  Button,
  Icon,
  LoadingSpinner,
  Pressable,
  Text,
  useCopy,
  useToast,
} from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { View, YStack } from 'tamagui';

import {
  type OpenAIAuthState,
  canDismissOpenAIAuth,
  copyOpenAIUserCode,
} from '../../features/settings/bot/openAiSubscription';
import { TextInput } from './Form';
import { ScreenHeader } from './ScreenHeader';

const logger = createDevLogger('LLMSubscriptionAuthView', false);

function flowFromState(state: OpenAIAuthState) {
  return 'flow' in state ? state.flow : undefined;
}

export function LLMSubscriptionAuthView({
  state,
  browserError,
  onStart,
  onOpenBrowser,
  onContinue,
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
  onOpenBrowser: () => Promise<void>;
  onContinue: () => void;
  onSubmitToken: (token: string) => Promise<boolean>;
  onRetry: () => void;
  onCancel: () => void;
  showBackButton?: boolean;
  providerLabel?: string;
  subscriptionLabel?: string;
  provider?: TlawnLLMAuthProvider;
}) {
  const flow = flowFromState(state);
  const userCode = flow?.userCode;
  const [copyError, setCopyError] = useState<string | null>(null);
  const [openingBrowser, setOpeningBrowser] = useState(false);
  const openingBrowserRef = useRef(false);
  const error =
    state.phase === 'error'
      ? state.message
      : state.phase === 'active' && state.error
        ? state.error
        : (copyError ?? browserError);
  const canGoBack = canDismissOpenAIAuth(state.phase);
  const isSetupToken = provider === 'anthropic';
  const isChatGPT = provider === 'openai';
  const connected = state.phase === 'connected';
  const [setupToken, setSetupToken] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);
  const { doCopy, didCopy } = useCopy(flow?.userCode ?? '');
  const showToast = useToast();
  const handleCopyCode = useCallback(async () => {
    setCopyError(null);
    try {
      const copied = await copyOpenAIUserCode(userCode, doCopy, () => {
        showToast({ message: 'Copied', duration: 1500 });
      });
      if (copied) return true;
    } catch {
      // A rejected write and a refused write have the same recovery action.
    }
    logger.trackError('Could not copy subscription sign-in code', { provider });
    setCopyError('Could not copy the code. Please try again.');
    return false;
  }, [doCopy, userCode, provider, showToast]);
  const handleCopyAndContinue = useCallback(async () => {
    if (openingBrowserRef.current) return;
    openingBrowserRef.current = true;
    setOpeningBrowser(true);
    try {
      // Safari only allows window.open synchronously inside the tap, so the
      // browser cannot wait for the clipboard write.
      await Promise.all([handleCopyCode(), onOpenBrowser()]);
    } finally {
      openingBrowserRef.current = false;
      setOpeningBrowser(false);
    }
  }, [handleCopyCode, onOpenBrowser]);
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
    setCopyError(null);
  }, [flow?.id]);

  useEffect(() => {
    if (state.phase === 'idle') {
      setSetupToken('');
      setSubmittingToken(false);
    }
  }, [state.phase]);

  return (
    <YStack flex={1} paddingTop="$2xl">
      {showBackButton ? (
        <View paddingHorizontal="$xl">
          <ScreenHeader.BackButton disabled={!canGoBack} onPress={onCancel} />
        </View>
      ) : null}
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={24}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <YStack gap="$3xl" padding="$xl" flexGrow={1} justifyContent="center">
          <YStack gap="$xl" alignItems="center">
            {connected ? (
              <Icon type="Checkmark" color="$positiveActionText" size="$xl" />
            ) : null}
            <Text size="$label/2xl" fontWeight="600" textAlign="center">
              {connected
                ? 'ChatGPT connected'
                : isChatGPT
                  ? 'Connect ChatGPT'
                  : `Connect your ${subscriptionLabel}`}
            </Text>
            <Text size="$body" color="$secondaryText" textAlign="center">
              {connected
                ? 'Your ChatGPT subscription is connected. Continue to choose a model for Tlonbot.'
                : isChatGPT
                  ? 'Copy the code, then paste it on the ChatGPT sign-in page to connect your subscription.'
                  : isSetupToken
                    ? 'Generate a Claude setup token on a computer with Claude Code, then paste it here.'
                    : `${providerLabel} will ask you to enter a one-time code. Once confirmed, your subscription will be linked.`}
            </Text>
          </YStack>

          {state.phase === 'idle' ? (
            <Button
              preset="primary"
              label={`Connect ${isChatGPT ? 'ChatGPT' : providerLabel}`}
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
                editable={flow?.status === 'awaiting_token' && !submittingToken}
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
                  accessibilityLabel={didCopy ? 'Copied' : 'Copy one-time code'}
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
                label={
                  isChatGPT
                    ? 'Copy and continue'
                    : `Open ${providerLabel} sign-in`
                }
                loading={openingBrowser}
                disabled={
                  !flow?.verificationUrl ||
                  (isChatGPT && (!flow.userCode || openingBrowser))
                }
                onPress={isChatGPT ? handleCopyAndContinue : onOpenBrowser}
              />
              {isChatGPT ? (
                <Text size="$label/s" color="$secondaryText" textAlign="center">
                  {Platform.OS === 'web'
                    ? 'After approving, return to Tlon to finish connecting.'
                    : 'After approving, close the sign-in window to return to Tlon.'}
                </Text>
              ) : null}
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

          {connected ? (
            <Button preset="primary" label="Continue" onPress={onContinue} />
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
      </KeyboardAwareScrollView>
    </YStack>
  );
}
