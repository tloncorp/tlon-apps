import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

type CompletionHandler = () => Promise<void>;

type BrowserCredentialHandoffCompletionContextValue = {
  register: (handler: CompletionHandler) => string;
  complete: (id: string) => Promise<void>;
  discard: (id: string) => void;
};

const BrowserCredentialHandoffCompletionContext =
  createContext<BrowserCredentialHandoffCompletionContextValue | null>(null);

export function BrowserCredentialHandoffCompletionProvider({
  children,
}: PropsWithChildren) {
  const handlers = useRef(new Map<string, CompletionHandler>());
  const sequence = useRef(0);

  const register = useCallback((handler: CompletionHandler) => {
    const id = `browser-handoff-${Date.now()}-${++sequence.current}`;
    handlers.current.set(id, handler);
    return id;
  }, []);

  const complete = useCallback(async (id: string) => {
    const handler = handlers.current.get(id);
    if (!handler) {
      throw new Error('The originating conversation is no longer available.');
    }
    handlers.current.delete(id);
    try {
      await handler();
    } catch (error) {
      handlers.current.set(id, handler);
      throw error;
    }
  }, []);

  const discard = useCallback((id: string) => {
    handlers.current.delete(id);
  }, []);

  const value = useMemo(
    () => ({ register, complete, discard }),
    [complete, discard, register]
  );

  return (
    <BrowserCredentialHandoffCompletionContext.Provider value={value}>
      {children}
    </BrowserCredentialHandoffCompletionContext.Provider>
  );
}

export function useBrowserCredentialHandoffCompletion() {
  const value = useContext(BrowserCredentialHandoffCompletionContext);
  if (!value) {
    throw new Error(
      'Browser credential handoff completion provider is unavailable.'
    );
  }
  return value;
}

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
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const browserHandoffCompletion = useBrowserCredentialHandoffCompletion();
  const completionId = route.params.completionId;

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

  useEffect(
    () => () => {
      if (completionId) browserHandoffCompletion.discard(completionId);
    },
    [browserHandoffCompletion, completionId]
  );

  const fillAndSubmit = useCallback(async () => {
    if (!handoff) return;
    if (
      (handoff.kind === 'password' &&
        (!password || (handoff.hasUsername && !username.trim()))) ||
      (handoff.kind === 'otp' &&
        (!code.trim() ||
          (handoff.codeLength !== undefined &&
            code.trim().length !== handoff.codeLength)))
    ) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await submitBrowserCredentials(
        handoff,
        handoff.kind === 'password'
          ? {
              ...(handoff.hasUsername ? { username: username.trim() } : {}),
              password,
              submit: true,
            }
          : { code: code.trim(), submit: true }
      );
      setUsername('');
      setPassword('');
      setCode('');
      setShowPassword(false);
      setSubmitted(true);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
    setSubmitting(false);
  }, [code, handoff, password, username]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(undefined);
    void load();
  }, [load]);

  const returnToConversation = useCallback(async () => {
    setReturning(true);
    setError(undefined);
    try {
      if (completionId) {
        await browserHandoffCompletion.complete(completionId);
      }
      navigation.goBack();
    } catch (nextError) {
      setError(errorMessage(nextError));
      setReturning(false);
    }
  }, [browserHandoffCompletion, completionId, navigation]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={navigation.goBack}
        title={
          handoff?.kind === 'otp' ? 'Browser verification' : 'Browser login'
        }
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
                  {handoff?.kind === 'otp'
                    ? 'Verification submitted'
                    : 'Login submitted'}
                </Text>
              </XStack>
              <Text color="$secondaryText">
                {handoff?.kind === 'otp'
                  ? 'Your code was sent directly to the hosted browser. It was not added to this conversation.'
                  : 'Your credentials were sent directly to the hosted browser. They were not added to this conversation.'}
              </Text>
              {error ? <Text color="$negativeActionText">{error}</Text> : null}
              <Button
                preset="primary"
                label="Return to conversation"
                centered
                loading={returning}
                disabled={returning}
                onPress={returnToConversation}
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
                    {handoff.kind === 'otp' ? 'Verify' : 'Sign in to'}{' '}
                    {originHost(handoff.origin)}
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
                  {handoff.kind === 'otp'
                    ? 'Your code goes directly to the live browser.'
                    : 'Your credentials go directly to the live browser.'}
                </Text>
                <Text color="$secondaryText">
                  {handoff.kind === 'otp' ? 'It is' : 'They are'} never posted
                  to chat or returned to the bot.
                </Text>
              </YStack>

              {handoff.kind === 'password' && handoff.hasUsername ? (
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

              {handoff.kind === 'password' ? (
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
              ) : (
                <Field label="Verification code" error={error}>
                  <YStack gap="$s">
                    <Text color="$secondaryText" paddingHorizontal="$xl">
                      {handoff.codeLength
                        ? `Enter the ${handoff.codeLength}-character code.`
                        : 'Enter the code you received.'}
                    </Text>
                    <TextInput
                      value={code}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      autoComplete="one-time-code"
                      importantForAutofill="yes"
                      textContentType="oneTimeCode"
                      maxLength={handoff.codeLength}
                      editable={!submitting}
                      onChangeText={setCode}
                      onSubmitEditing={() => void fillAndSubmit()}
                    />
                  </YStack>
                </Field>
              )}

              <Button
                preset="primary"
                label={
                  handoff.kind === 'otp' ? 'Submit code' : 'Fill and sign in'
                }
                centered
                loading={submitting}
                disabled={
                  submitting ||
                  (handoff.kind === 'password'
                    ? !password || (handoff.hasUsername && !username.trim())
                    : !code.trim() ||
                      (handoff.codeLength !== undefined &&
                        code.trim().length !== handoff.codeLength))
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
