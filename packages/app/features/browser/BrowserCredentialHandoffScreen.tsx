import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { ScrollView, View, XStack, YStack, isWeb } from 'tamagui';

import type { BrowserCredentialHandoffParams } from '../../navigation/types';
import {
  Field,
  ScreenHeader,
  SettingsContentScrollView,
  TextInput,
} from '../../ui';
import {
  type BrowserCredentialHandoff,
  type BrowserSecureField,
  beginBrowserCredentialHandoff,
  nextBrowserCredentialHandoff,
  submitBrowserCredentials,
  trustedBrowserViewerUrl,
  validBrowserFormValues,
} from './browserCredentialHandoff';
import { useBrowserCredentialHandoff } from './BrowserCredentialHandoffProvider';

type Props = {
  navigation: { goBack(): void; isFocused(): boolean };
  route: { params: BrowserCredentialHandoffParams };
};
function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Could not connect to the browser form.';
}

function SecureField({
  field,
  value,
  disabled,
  onChange,
  onSubmit,
}: {
  field: BrowserSecureField;
  value: string;
  disabled: boolean;
  onChange(value: string): void;
  onSubmit(): void;
}) {
  const [visible, setVisible] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');
  const options = field.options;
  const password = field.inputType === 'password';
  const autocomplete =
    field.purpose === 'one-time-code'
      ? 'one-time-code'
      : isWeb
        ? 'off'
        : field.purpose === 'username'
          ? 'username'
          : field.purpose === 'current-password'
            ? 'current-password'
            : 'off';
  return (
    <Field label={`${field.label}${field.required ? '' : ' (optional)'}`}>
      {options ? (
        <YStack gap="$s">
          <Button
            preset="secondary"
            label={
              options.find((option) => option.value === value)?.label ??
              `Choose ${field.label.toLowerCase()}`
            }
            disabled={disabled}
            onPress={() => setChoosing((open) => !open)}
          />
          {choosing ? (
            <YStack gap="$s">
              {options.length > 12 ? (
                <TextInput
                  accessibilityLabel={`Search ${field.label.toLowerCase()}`}
                  value={search}
                  autoComplete="off"
                  autoCorrect={false}
                  onChangeText={setSearch}
                  placeholder="Search options"
                />
              ) : null}
              <ScrollView maxHeight={220} nestedScrollEnabled>
                <YStack gap="$s">
                  {options
                    .filter((option) =>
                      option.label.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((option) => (
                      <Button
                        key={option.value}
                        preset="secondary"
                        label={option.label}
                        disabled={disabled}
                        onPress={() => {
                          onChange(option.value);
                          setChoosing(false);
                          setSearch('');
                        }}
                      />
                    ))}
                </YStack>
              </ScrollView>
            </YStack>
          ) : null}
        </YStack>
      ) : (
        <XStack alignItems="center" gap="$m">
          <View flex={1}>
            <TextInput
              accessibilityLabel={field.label}
              value={value}
              secureTextEntry={password && !visible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={autocomplete}
              importantForAutofill={autocomplete === 'off' ? 'no' : 'yes'}
              textContentType={
                autocomplete === 'one-time-code'
                  ? 'oneTimeCode'
                  : autocomplete === 'username'
                    ? 'username'
                    : autocomplete === 'current-password'
                      ? 'password'
                      : 'none'
              }
              keyboardType={
                field.inputType === 'numeric' || field.purpose === 'cc-csc'
                  ? 'number-pad'
                  : field.inputType === 'email'
                    ? 'email-address'
                    : field.inputType === 'tel'
                      ? 'phone-pad'
                      : 'default'
              }
              multiline={field.inputType === 'textarea'}
              maxLength={field.exactLength ?? field.maxLength}
              placeholder={
                field.exactLength
                  ? `${field.exactLength} characters`
                  : undefined
              }
              editable={!disabled}
              onChangeText={onChange}
              onSubmitEditing={
                field.inputType === 'textarea' ? undefined : onSubmit
              }
            />
          </View>
          {password ? (
            <Pressable
              accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`}
              onPress={() => setVisible((shown) => !shown)}
            >
              <Icon
                type={visible ? 'EyeClosed' : 'EyeOpen'}
                size="$m"
                color="$secondaryText"
              />
            </Pressable>
          ) : null}
        </XStack>
      )}
    </Field>
  );
}

export function BrowserCredentialHandoffScreen({ navigation, route }: Props) {
  const [handoff, setHandoff] = useState<BrowserCredentialHandoff>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [filled, setFilled] = useState(false);
  const [error, setError] = useState<string>();
  const { resolve, complete, discard } = useBrowserCredentialHandoff();
  const handoffId = route.params.handoffId;
  const activeHandoffs = useRef(new Set<string>());
  const submittingRef = useRef(false);
  const requestController = useRef<AbortController | undefined>(undefined);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setValues({});
      setHandoff(undefined);
      setFilled(false);
      const viewerUrl = resolve(handoffId);
      if (!viewerUrl) {
        setError('Reopen the secure browser form from the conversation.');
        setLoading(false);
        return;
      }
      try {
        const next = await beginBrowserCredentialHandoff(viewerUrl, signal);
        if (!signal?.aborted) setHandoff(next);
      } catch (nextError) {
        if (!signal?.aborted) setError(errorMessage(nextError));
      }
      if (!signal?.aborted) setLoading(false);
    },
    [handoffId, resolve]
  );

  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const active = activeHandoffs.current;
    active.add(handoffId);
    return () => {
      active.delete(handoffId);
      // Retain the in-memory handoff during Strict Mode's effect replay.
      queueMicrotask(() => {
        if (!active.has(handoffId)) discard(handoffId);
      });
    };
  }, [discard, handoffId]);

  const returnToConversation = useCallback(async () => {
    setReturning(true);
    setError(undefined);
    try {
      await complete(handoffId);
      if (!requestController.current?.signal.aborted && navigation.isFocused())
        navigation.goBack();
    } catch (nextError) {
      if (requestController.current?.signal.aborted) return;
      setError(errorMessage(nextError));
      setReturning(false);
    }
  }, [complete, handoffId, navigation]);

  const fillAndSubmit = useCallback(async () => {
    const signal = requestController.current?.signal;
    if (
      !handoff ||
      submittingRef.current ||
      !signal ||
      signal.aborted ||
      !validBrowserFormValues(handoff, values)
    )
      return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await submitBrowserCredentials(
        handoff,
        { values, submit: handoff.kind === 'login' },
        signal
      );
      if (signal.aborted) return;
      setValues({});
      setHandoff(undefined);
      if (handoff.kind === 'login') {
        const viewerUrl = resolve(handoffId);
        if (!viewerUrl)
          throw new Error(
            'Reopen the secure browser form from the conversation.'
          );
        setLoading(true);
        const next = await nextBrowserCredentialHandoff(
          viewerUrl,
          handoff.formId,
          signal
        );
        if (signal.aborted) return;
        setLoading(false);
        if (next && (next.formId !== handoff.formId || result.submitted)) {
          setHandoff(next);
          if (next.formId === handoff.formId)
            setError(
              'The site still shows this form. Check the browser before trying again.'
            );
          return;
        }
      }
      setFilled(true);
      // The agent checks the resulting page; filling does not prove sign-in
      // or authorize a payment, order, or other consequential action.
      await returnToConversation();
    } catch (nextError) {
      if (signal.aborted) return;
      setValues({});
      setHandoff(undefined);
      setLoading(false);
      setError(errorMessage(nextError));
    } finally {
      submittingRef.current = false;
      if (!signal.aborted) setSubmitting(false);
    }
  }, [handoff, values, resolve, handoffId, returnToConversation]);

  const retry = useCallback(() => {
    const signal = requestController.current?.signal;
    if (!signal || signal.aborted) return;
    setLoading(true);
    setError(undefined);
    void load(signal);
  }, [load]);
  const dismiss = useCallback(() => {
    requestController.current?.abort();
    navigation.goBack();
  }, [navigation]);
  const openBrowser = useCallback(async () => {
    try {
      const viewerUrl = resolve(handoffId);
      if (!viewerUrl)
        throw new Error(
          'Reopen the secure browser form from the conversation.'
        );
      await Linking.openURL(trustedBrowserViewerUrl(viewerUrl));
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, [resolve, handoffId]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={dismiss}
        title="Secure browser form"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$xl" maxWidth={560} width="100%" alignSelf="center">
          <YStack
            backgroundColor="$background"
            borderColor="$border"
            borderWidth={1}
            borderRadius="$l"
            padding="$xl"
            gap="$xl"
          >
            {loading ? (
              <Text color="$secondaryText">
                {submitting ? 'Checking the next step…' : 'Finding the form…'}
              </Text>
            ) : filled ? (
              <>
                <Text size="$label/l" fontWeight="600">
                  Fields entered
                </Text>
                <Text color="$secondaryText">
                  Your information was sent directly to the browser. The bot
                  will check the page and continue.
                </Text>
                {error ? (
                  <Text color="$negativeActionText">{error}</Text>
                ) : null}
                <Button
                  preset="primary"
                  label="Return to conversation"
                  centered
                  loading={returning}
                  disabled={returning}
                  onPress={returnToConversation}
                />
              </>
            ) : handoff ? (
              <>
                <XStack alignItems="center" gap="$m">
                  <Icon type="Lock" size="$m" color="$primaryText" />
                  <YStack flex={1} gap="$xs">
                    <Text size="$label/l" fontWeight="600">
                      {handoff.kind === 'login'
                        ? 'Sign in to'
                        : 'Enter details for'}{' '}
                      {new URL(handoff.origin).hostname}
                    </Text>
                    <Text color="$secondaryText">{handoff.origin}</Text>
                  </YStack>
                </XStack>
                <Text color="$secondaryText">
                  These fields go directly to the live browser. They are never
                  posted to chat or returned to the bot.
                </Text>
                {handoff.kind === 'details' ? (
                  <Text color="$secondaryText">
                    Filling these fields does not submit a payment or place an
                    order.
                  </Text>
                ) : null}
                {handoff.fields.map((field) => (
                  <SecureField
                    key={`${handoff.formId}:${field.id}`}
                    field={field}
                    value={values[field.id] ?? ''}
                    disabled={submitting}
                    onChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [field.id]: value,
                      }))
                    }
                    onSubmit={() => void fillAndSubmit()}
                  />
                ))}
                {error ? (
                  <Text color="$negativeActionText">{error}</Text>
                ) : null}
                <Button
                  preset="primary"
                  label={handoff.kind === 'login' ? 'Continue' : 'Fill fields'}
                  centered
                  loading={submitting}
                  disabled={
                    submitting || !validBrowserFormValues(handoff, values)
                  }
                  onPress={fillAndSubmit}
                />
              </>
            ) : (
              <>
                <Text color="$negativeActionText">
                  {error ?? 'Could not find a supported browser form.'}
                </Text>
                <Button
                  preset="secondary"
                  label="Try again"
                  centered
                  onPress={retry}
                />
              </>
            )}
          </YStack>
          {!loading && !submitting && !returning && !filled ? (
            <YStack gap="$m">
              <Button
                preset="secondary"
                label="Open live browser"
                centered
                onPress={openBrowser}
              />
              <Text color="$secondaryText">
                You can complete any additional steps in the browser, then
                return to the conversation.
              </Text>
              <Button
                preset="secondary"
                label="Return to conversation"
                centered
                onPress={returnToConversation}
              />
            </YStack>
          ) : null}
        </YStack>
      </SettingsContentScrollView>
    </View>
  );
}
