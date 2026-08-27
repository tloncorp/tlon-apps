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
            <Text color="$secondaryText">Finding the login form…</Text>
          ) : submitted ? (
            <YStack gap="$l">
              <Text size="$label/l" fontWeight="600">
                Login submitted
              </Text>
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
            <YStack gap="$xl">
              <YStack gap="$xs">
                <Text size="$label/l" fontWeight="600">
                  Sign in to {handoff.origin}
                </Text>
                <Text color="$secondaryText">
                  These values go directly to the live browser and are never
                  posted to chat or returned to the bot.
                </Text>
              </YStack>

              {handoff.hasUsername ? (
                <Field label="Username or email">
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
            <YStack gap="$l">
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
