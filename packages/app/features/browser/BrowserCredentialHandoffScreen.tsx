import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import type {
  BrowserLoginChoice,
  SavedBrowserLogin,
} from '@tloncorp/api/client/browserVault';
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
  cancelBrowserCredentialHandoff,
  nextBrowserCredentialHandoff,
  submitBrowserCredentials,
  supportsSavedLogins,
  trustedBrowserViewerUrl,
  validBrowserFormValues,
  authorizeBrowserLogins,
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
  const [authorization, setVaultAuth] = useState<{
    fillUrl: string;
    grant: string;
    accounts: SavedBrowserLogin[];
  }>();
  const [vaultError, setVaultError] = useState<string>();
  const [saveLogin, setSaveLogin] = useState(false);
  const [accountLabel, setAccountLabel] = useState('');
  const [choice, setChoice] = useState<{
    mode: 'use' | 'update';
    record: BrowserLoginChoice;
  }>();
  const [saveNotice, setSaveNotice] = useState<string>();
  const { resolve, complete, discard } = useBrowserCredentialHandoff();
  const handoffId = route.params.handoffId;
  const activeHandoffs = useRef(new Set<string>());
  const outcomes = useRef(
    new Map<string, 'completing' | 'completed' | 'canceled'>()
  );
  const pendingSave = useRef<{ handoffId: string; origin: string } | undefined>(
    undefined
  );
  const submittingRef = useRef(false);
  const requestController = useRef<AbortController | undefined>(undefined);
  const vaultEligible = !!handoff?.vault && supportsSavedLogins(handoff);
  const vaultAuth =
    vaultEligible && authorization?.fillUrl === handoff?.fillUrl
      ? authorization
      : undefined;
  const usernameField = handoff?.fields.find(
    (field) => field.purpose === 'username'
  );
  const saveLabel =
    accountLabel.trim() ||
    (usernameField ? values[usernameField.id]?.slice(0, 256) : '');
  const canSubmit =
    !!handoff &&
    (choice?.mode === 'use' || validBrowserFormValues(handoff, values)) &&
    (!(choice?.mode === 'use' || saveLogin) || !!vaultAuth) &&
    (!saveLogin || choice?.mode === 'use' || !!saveLabel);

  const clearSavedLoginSelection = useCallback(() => {
    pendingSave.current = undefined;
    setSaveLogin(false);
    setChoice(undefined);
    setAccountLabel('');
    setSaveNotice(undefined);
  }, []);

  useEffect(() => {
    setVaultAuth(undefined);
    setVaultError(undefined);
    if (!handoff || !vaultEligible) return;
    const controller = new AbortController();
    void authorizeBrowserLogins(handoff, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setVaultAuth({ ...result, fillUrl: handoff.fillUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          clearSavedLoginSelection();
          setVaultError(
            'Saved logins are unavailable. You can still enter your login.'
          );
        }
      });
    return () => controller.abort();
  }, [handoff, vaultEligible, clearSavedLoginSelection]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setValues({});
      setHandoff(undefined);
      setFilled(false);
      const pendingOrigin =
        pendingSave.current?.handoffId === handoffId
          ? pendingSave.current.origin
          : undefined;
      if (!pendingOrigin) clearSavedLoginSelection();
      const viewerUrl = resolve(handoffId);
      if (!viewerUrl) {
        setError('Reopen the secure browser form from the conversation.');
        setLoading(false);
        return;
      }
      try {
        const next = await beginBrowserCredentialHandoff(viewerUrl, signal);
        if (!signal?.aborted) {
          if (
            pendingOrigin &&
            (next.origin !== pendingOrigin ||
              !next.vault ||
              !supportsSavedLogins(next))
          )
            clearSavedLoginSelection();
          setHandoff(next);
        }
      } catch (nextError) {
        if (!signal?.aborted) setError(errorMessage(nextError));
      }
      if (!signal?.aborted) setLoading(false);
    },
    [handoffId, resolve, clearSavedLoginSelection]
  );

  const cancelHandoff = useCallback((id: string, viewerUrl?: string) => {
    if (outcomes.current.has(id)) return;
    outcomes.current.set(id, 'canceled');
    if (viewerUrl)
      void cancelBrowserCredentialHandoff(viewerUrl).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const active = activeHandoffs.current;
    const viewerUrl = resolve(handoffId);
    active.add(handoffId);
    return () => {
      active.delete(handoffId);
      // Retain the in-memory handoff during Strict Mode's effect replay.
      queueMicrotask(() => {
        if (!active.has(handoffId)) {
          cancelHandoff(handoffId, viewerUrl);
          discard(handoffId);
        }
      });
    };
  }, [cancelHandoff, discard, handoffId, resolve]);

  const returnToConversation = useCallback(async () => {
    if (outcomes.current.has(handoffId)) return;
    const viewerUrl = resolve(handoffId);
    const signal = requestController.current?.signal;
    outcomes.current.set(handoffId, 'completing');
    setReturning(true);
    setError(undefined);
    try {
      await complete(handoffId);
      outcomes.current.set(handoffId, 'completed');
      if (
        activeHandoffs.current.has(handoffId) &&
        !signal?.aborted &&
        navigation.isFocused()
      )
        navigation.goBack();
    } catch (nextError) {
      outcomes.current.delete(handoffId);
      if (!activeHandoffs.current.has(handoffId))
        cancelHandoff(handoffId, viewerUrl);
      if (signal?.aborted) return;
      setError(errorMessage(nextError));
      setReturning(false);
    }
  }, [cancelHandoff, complete, handoffId, navigation, resolve]);

  const fillAndSubmit = useCallback(async () => {
    const signal = requestController.current?.signal;
    if (
      !handoff ||
      submittingRef.current ||
      !signal ||
      signal.aborted ||
      !canSubmit
    )
      return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await submitBrowserCredentials(
        handoff,
        {
          values: choice?.mode === 'use' ? undefined : values,
          submit: handoff.kind === 'login',
          ...(vaultAuth && (choice?.mode === 'use' || saveLogin)
            ? { grant: vaultAuth.grant }
            : {}),
          ...(choice?.mode === 'use' ? { use: choice.record } : {}),
          ...(saveLogin && choice?.mode !== 'use'
            ? {
                save: {
                  ...(saveLabel ? { label: saveLabel } : {}),
                  ...(choice?.mode === 'update'
                    ? { update: choice.record }
                    : {}),
                },
              }
            : {}),
        },
        signal
      );
      if (signal.aborted) return;
      setValues({});
      setHandoff(undefined);
      pendingSave.current =
        result.saveStatus === 'pending'
          ? { handoffId, origin: handoff.origin }
          : undefined;
      if (result.saveStatus === 'pending' && saveLabel)
        setAccountLabel(saveLabel);
      if (result.saveStatus)
        setSaveNotice(
          result.saveStatus === 'saved'
            ? 'Login saved for this bot.'
            : result.saveStatus === 'pending'
              ? 'Continue to the password step to save this login.'
              : 'Your login was entered, but could not be saved.'
        );
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
        // A filled form with no safe submit control continues through the bot's
        // browser-owned receipt instead of asking the user to enter it again.
        if (next && (next.formId !== handoff.formId || result.submitted)) {
          if (
            next.origin !== handoff.origin ||
            !next.vault ||
            !supportsSavedLogins(next) ||
            (result.saveStatus !== 'pending' && choice?.mode !== 'use')
          ) {
            clearSavedLoginSelection();
          }
          setHandoff(next);
          if (next.formId === handoff.formId)
            setError(
              'The site still shows this form. Check the browser before trying again.'
            );
          return;
        }
      }
      if (result.saveStatus === 'pending') {
        setError('The next step is not ready. Try again or open the browser.');
        return;
      }
      setFilled(true);
      // The agent checks the resulting page; filling does not prove sign-in
      // or authorize a payment, order, or other consequential action.
      if (result.saveStatus !== 'failed') await returnToConversation();
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
  }, [
    handoff,
    values,
    resolve,
    handoffId,
    returnToConversation,
    vaultAuth,
    choice,
    saveLogin,
    saveLabel,
    canSubmit,
    clearSavedLoginSelection,
  ]);

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
            {saveNotice ? (
              <Text color="$secondaryText">{saveNotice}</Text>
            ) : null}
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
                {vaultAuth?.accounts.length ? (
                  <YStack gap="$s">
                    <Text>Saved logins</Text>
                    {vaultAuth.accounts.map((account) => (
                      <YStack key={account.id} gap="$s">
                        <Button
                          preset="secondary"
                          label={`${choice?.record.id === account.id ? 'Selected: ' : ''}${account.label}`}
                          disabled={submitting}
                          onPress={() => {
                            setChoice({
                              mode: 'use',
                              record: {
                                id: account.id,
                                revision: account.revision,
                              },
                            });
                            setSaveLogin(false);
                            setValues({});
                          }}
                        />
                        <Button
                          preset="secondary"
                          label={`Update ${account.label}`}
                          disabled={submitting}
                          onPress={() => {
                            setChoice({
                              mode: 'update',
                              record: {
                                id: account.id,
                                revision: account.revision,
                              },
                            });
                            setSaveLogin(true);
                            setAccountLabel(account.label);
                            setValues({});
                          }}
                        />
                      </YStack>
                    ))}
                    <Button
                      preset="secondary"
                      label="Enter a new login"
                      disabled={submitting}
                      onPress={() => {
                        setChoice(undefined);
                        setSaveLogin(false);
                        setAccountLabel('');
                        setValues({});
                      }}
                    />
                  </YStack>
                ) : null}
                {vaultError ? (
                  <Text color="$secondaryText">{vaultError}</Text>
                ) : null}
                {choice?.mode !== 'use'
                  ? handoff.fields.map((field) => (
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
                    ))
                  : null}
                {vaultEligible && choice?.mode !== 'use' ? (
                  <YStack gap="$m">
                    <Pressable
                      style={{
                        minHeight: 48,
                        justifyContent: 'center',
                        paddingVertical: 12,
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: saveLogin,
                        disabled: submitting || !vaultAuth,
                      }}
                      disabled={submitting || !vaultAuth}
                      onPress={() => setSaveLogin((save) => !save)}
                    >
                      <Text>
                        {saveLogin ? '☑' : '☐'} Save login for this bot
                      </Text>
                    </Pressable>
                    {saveLogin ? (
                      <>
                        <Text color="$secondaryText">
                          This bot can use the saved login on {handoff.origin}.
                          Manage it in Bot settings.
                        </Text>
                        <Field
                          label={
                            usernameField
                              ? 'Account label (optional)'
                              : 'Account label'
                          }
                        >
                          <TextInput
                            value={accountLabel}
                            onChangeText={setAccountLabel}
                            maxLength={256}
                            editable={!submitting}
                            placeholder="Personal or work"
                            autoComplete="off"
                          />
                        </Field>
                      </>
                    ) : null}
                  </YStack>
                ) : null}
                {error ? (
                  <Text color="$negativeActionText">{error}</Text>
                ) : null}
                <Button
                  preset="primary"
                  label={handoff.kind === 'login' ? 'Continue' : 'Fill fields'}
                  centered
                  loading={submitting}
                  disabled={submitting || !canSubmit}
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
