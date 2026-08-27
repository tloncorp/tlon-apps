import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import type { BrowserCredentialHandoffParams } from '../../navigation/BasePathNavigator';
import {
  Field,
  ScreenHeader,
  SettingsContentScrollView,
  TextInput,
} from '../../ui';
import {
  type BrowserCredentialHandoff,
  beginBrowserCredentialHandoff,
  submitBrowserCredentials,
} from './browserCredentialHandoff';

type Props = {
  navigation: { goBack(): void };
  route: { params: BrowserCredentialHandoffParams };
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Could not connect to the browser login form.';
}

function originHost(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

export function BrowserCredentialHandoffScreen({ navigation, route }: Props) {
  const [handoff, setHandoff] = useState<BrowserCredentialHandoff>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setHandoff(
          await beginBrowserCredentialHandoff(route.params.viewerUrl, signal)
        );
      } catch (nextError) {
        if (!signal?.aborted) setError(errorMessage(nextError));
      }
      if (!signal?.aborted) setLoading(false);
    },
    [route.params.viewerUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const fillAndSubmit = useCallback(async () => {
    if (!handoff || !password || (handoff.hasUsername && !username.trim())) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await submitBrowserCredentials(handoff, {
        ...(handoff.hasUsername ? { username: username.trim() } : {}),
        password,
        submit: true,
      });
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setSubmitted(true);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
    setSubmitting(false);
  }, [handoff, password, username]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(undefined);
    void load();
  }, [load]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={navigation.goBack}
        title="Browser login"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$xl" maxWidth={560} width="100%" alignSelf="center">
          {loading ? (
            <YStack
              backgroundColor="$background"
              borderColor="$border"
              borderWidth={1}
              borderRadius="$l"
              padding="$xl"
              gap="$m"
            >
              <Text size="$label/l" fontWeight="600">
                Connecting to the browser
              </Text>
              <Text color="$secondaryText">Finding the login form…</Text>
            </YStack>
          ) : submitted ? (
            <YStack
              backgroundColor="$background"
              borderColor="$border"
              borderWidth={1}
              borderRadius="$l"
              padding="$xl"
              gap="$l"
            >
              <XStack alignItems="center" gap="$m">
                <View
                  backgroundColor="$positiveBackground"
                  borderRadius={100}
                  padding="$m"
                >
                  <Icon
                    type="Checkmark"
                    size="$m"
                    color="$positiveActionText"
                  />
                </View>
                <Text size="$label/l" fontWeight="600">
                  Login submitted
                </Text>
              </XStack>
              <Text color="$secondaryText">
                Your credentials were sent directly to the hosted browser. They
                were not added to this conversation.
              </Text>
              <Button
                preset="primary"
                label="Done"
                centered
                onPress={navigation.goBack}
              />
            </YStack>
          ) : handoff ? (
            <YStack
              backgroundColor="$background"
              borderColor="$border"
              borderWidth={1}
              borderRadius="$l"
              padding="$xl"
              gap="$xl"
            >
              <XStack alignItems="center" gap="$m">
                <View
                  backgroundColor="$secondaryBackground"
                  borderRadius={100}
                  padding="$m"
                >
                  <Icon type="Lock" size="$m" color="$primaryText" />
                </View>
                <YStack flex={1} gap="$xs">
                  <Text size="$label/l" fontWeight="600">
                    Sign in to {originHost(handoff.origin)}
                  </Text>
                  <Text color="$secondaryText" numberOfLines={1}>
                    {handoff.origin}
                  </Text>
                </YStack>
              </XStack>

              <YStack
                backgroundColor="$secondaryBackground"
                borderRadius="$m"
                padding="$l"
                gap="$xs"
              >
                <Text color="$secondaryText">
                  Your credentials go directly to the live browser.
                </Text>
                <Text color="$secondaryText">
                  They are never posted to chat or returned to the bot.
                </Text>
              </YStack>

              {handoff.hasUsername ? (
                <Field label="Email or username">
                  <TextInput
                    value={username}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    importantForAutofill="yes"
                    textContentType="username"
                    editable={!submitting}
                    onChangeText={setUsername}
                  />
                </Field>
              ) : null}

              <Field label="Password" error={error}>
                <XStack alignItems="center" gap="$m">
                  <View flex={1}>
                    <TextInput
                      value={password}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="current-password"
                      importantForAutofill="yes"
                      textContentType="password"
                      editable={!submitting}
                      onChangeText={setPassword}
                      onSubmitEditing={() => void fillAndSubmit()}
                    />
                  </View>
                  <Pressable
                    accessibilityLabel={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    onPress={() => setShowPassword((value) => !value)}
                  >
                    <Icon
                      type={showPassword ? 'EyeClosed' : 'EyeOpen'}
                      size="$m"
                      color="$secondaryText"
                    />
                  </Pressable>
                </XStack>
              </Field>

              <Button
                preset="primary"
                label="Fill and sign in"
                centered
                loading={submitting}
                disabled={
                  submitting ||
                  !password ||
                  (handoff.hasUsername && !username.trim())
                }
                onPress={fillAndSubmit}
              />
            </YStack>
          ) : (
            <YStack
              backgroundColor="$background"
              borderColor="$border"
              borderWidth={1}
              borderRadius="$l"
              padding="$xl"
              gap="$l"
            >
              <Text color="$negativeActionText">
                {error ?? 'Could not find the browser login form.'}
              </Text>
              <Button
                preset="secondary"
                label="Try again"
                centered
                onPress={retry}
              />
            </YStack>
          )}
        </YStack>
      </SettingsContentScrollView>
    </View>
  );
}
