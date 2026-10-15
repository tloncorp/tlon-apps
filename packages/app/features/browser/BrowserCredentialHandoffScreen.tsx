import type {
  BrowserLoginChoice,
  SavedBrowserLogin,
} from '@tloncorp/api/client/browserVault';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Switch } from 'react-native';
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
  BrowserFormError,
  authorizeBrowserLogins,
  authorizeBrowserViewer,
  beginBrowserCredentialHandoff,
  cancelBrowserCredentialHandoff,
  nextBrowserCredentialHandoff,
  submitBrowserCredentials,
  supportsSavedLogins,
  trustedBrowserViewerUrl,
  validBrowserFormValues,
} from './browserCredentialHandoff';
import { openBrowserViewerWindow } from './browserViewerWindow';
import { useBrowserCredentialHandoff } from './BrowserCredentialHandoffProvider';
import { BrowserViewerModal } from './BrowserViewerModal';

type Props = {
  navigation: { goBack(): void; isFocused(): boolean };
  route: { params: BrowserCredentialHandoffParams };
};

const SAVE_NOTICES = {
  saved: 'Login saved for this bot.',
  pending: 'Continue to the password step to save this login.',
  failed: 'Your login was entered, but could not be saved.',
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
  const loginApproval = route.params.loginApproval;
  const [approved, setApproved] = useState(false);
  const [handoff, setHandoff] = useState<BrowserCredentialHandoff>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [filled, setFilled] = useState(false);
  const [noSecureForm, setNoSecureForm] = useState(false);
  const [liveViewer, setLiveViewer] = useState<{
    url: string;
    handoffId: string;
  }>();
  const [error, setError] = useState<string>();
  const [authorization, setAuthorization] = useState<{
    fillUrl: string;
    grant: string;
    accounts: SavedBrowserLogin[];
  }>();
  const [vaultError, setVaultError] = useState<string>();
  const [vaultRequested, setVaultRequested] = useState(false);
  const [showSavedLogins, setShowSavedLogins] = useState(false);
  const [saveLogin, setSaveLogin] = useState(false);
  const [allowAutomatic, setAllowAutomatic] = useState(false);
  const [accountLabel, setAccountLabel] = useState('');
  const [choice, setChoice] = useState<{
    mode: 'use' | 'update';
    record: BrowserLoginChoice;
  }>();
  const [saveStatus, setSaveStatus] = useState<keyof typeof SAVE_NOTICES>();
  const saveNotice = saveStatus ? SAVE_NOTICES[saveStatus] : undefined;
  const { resolve, complete, discard } = useBrowserCredentialHandoff();
  const handoffId = route.params.handoffId;
  const activeHandoffs = useRef(new Set<string>());
  const outcomes = useRef(
    new Map<string, 'completing' | 'completed' | 'canceled'>()
  );
  const pendingSave = useRef<{ handoffId: string; origin: string } | undefined>(
    undefined
  );
  const externalViewerHandoff = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const requestController = useRef<AbortController | undefined>(undefined);
  const vaultEligible = !!handoff?.vault && supportsSavedLogins(handoff);
  const approvingSavedLogin = !!loginApproval && (!approved || vaultEligible);
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
  const choiceIsCurrent =
    !choice ||
    !!vaultAuth?.accounts.some(
      (account) =>
        account.id === choice.record.id &&
        account.revision === choice.record.revision
    );
  const canSubmit =
    !!handoff &&
    (!approvingSavedLogin || choice?.mode === 'use') &&
    choiceIsCurrent &&
    (choice?.mode === 'use' || validBrowserFormValues(handoff, values)) &&
    (!(choice?.mode === 'use' || saveLogin) || !!vaultAuth) &&
    (!saveLogin || choice?.mode === 'use' || !!saveLabel);

  const clearSavedLoginSelection = useCallback(() => {
    pendingSave.current = undefined;
    setSaveStatus((status) => (status === 'pending' ? undefined : status));
    setSaveLogin(false);
    setAllowAutomatic(false);
    setChoice(undefined);
    setAccountLabel('');
    setVaultRequested(false);
    setShowSavedLogins(false);
  }, []);

  useEffect(() => {
    setAuthorization(undefined);
    if (!handoff || !vaultEligible || (!vaultRequested && !approvingSavedLogin))
      return;
    setVaultError(undefined);
    const controller = new AbortController();
    void authorizeBrowserLogins(handoff, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setAuthorization({ ...result, fillUrl: handoff.fillUrl });
        if (approvingSavedLogin) {
          const requested = loginApproval?.record;
          const account = requested
            ? result.accounts.find(
                (account) =>
                  account.id === requested.id &&
                  account.revision === requested.revision
              )
            : result.accounts.length === 1
              ? result.accounts[0]
              : undefined;
          if (account) {
            setChoice({
              mode: 'use',
              record: { id: account.id, revision: account.revision },
            });
            setAllowAutomatic(false);
          } else if (requested || !result.accounts.length) {
            setVaultError(
              'This saved login is no longer available. Cancel and ask your bot to check again.'
            );
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          clearSavedLoginSelection();
          setVaultError(
            approvingSavedLogin
              ? 'Could not load the saved login. Cancel or try again.'
              : 'Saved logins are unavailable. You can still enter your login.'
          );
        }
      });
    return () => controller.abort();
  }, [
    handoff,
    vaultEligible,
    vaultRequested,
    approvingSavedLogin,
    loginApproval,
    clearSavedLoginSelection,
  ]);

  useEffect(() => {
    if (vaultAuth && choice && !choiceIsCurrent) {
      clearSavedLoginSelection();
      setVaultError(
        'This saved login changed or was deleted. Enter your login or choose it again.'
      );
    }
  }, [vaultAuth, choice, choiceIsCurrent, clearSavedLoginSelection]);

  const load = useCallback(
    async (signal?: AbortSignal, openWhenMissing = true) => {
      setValues({});
      setHandoff(undefined);
      setFilled(false);
      const pendingOrigin =
        pendingSave.current?.handoffId === handoffId
          ? pendingSave.current.origin
          : undefined;
      if (!pendingOrigin) {
        clearSavedLoginSelection();
        setSaveStatus(undefined);
      }
      setVaultError(undefined);
      setNoSecureForm(false);
      setError(undefined);
      const viewerUrl = resolve(handoffId);
      if (!viewerUrl) {
        setError('Reopen the secure browser form from the conversation.');
        setLoading(false);
        return;
      }
      let trustedUrl: string | undefined;
      try {
        trustedUrl = trustedBrowserViewerUrl(viewerUrl);
        const next = await beginBrowserCredentialHandoff(trustedUrl, signal);
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
        if (signal?.aborted) return;
        if (
          nextError instanceof BrowserFormError &&
          (nextError.status === 404 ||
            (!openWhenMissing && nextError.status === 409)) &&
          trustedUrl
        ) {
          setNoSecureForm(true);
          if (!isWeb && openWhenMissing && !loginApproval) {
            Keyboard.dismiss();
            try {
              const ownerUrl = await authorizeBrowserViewer(trustedUrl);
              if (!signal?.aborted) setLiveViewer({ url: ownerUrl, handoffId });
            } catch {
              setError('The browser could not be authorized. Try again.');
            }
          }
        } else {
          setError(errorMessage(nextError));
        }
      }
      if (!signal?.aborted) setLoading(false);
    },
    [handoffId, resolve, clearSavedLoginSelection, loginApproval]
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
          ...(choice?.mode === 'use'
            ? { use: choice.record, allowAutomatic }
            : {}),
          ...(saveLogin && choice?.mode !== 'use'
            ? {
                save: {
                  permission: allowAutomatic ? 'allow' : 'ask',
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
      if (approvingSavedLogin) setApproved(true);
      setValues({});
      setHandoff(undefined);
      pendingSave.current =
        result.saveStatus === 'pending'
          ? { handoffId, origin: handoff.origin }
          : undefined;
      if (result.saveStatus === 'pending' && saveLabel)
        setAccountLabel(saveLabel);
      if (result.saveStatus) setSaveStatus(result.saveStatus);
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
              "Sign-in hasn't completed. Open the live browser to check for a verification step or error."
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
    approvingSavedLogin,
    vaultAuth,
    choice,
    saveLogin,
    allowAutomatic,
    saveLabel,
    canSubmit,
    clearSavedLoginSelection,
  ]);

  const reloadForm = useCallback(
    (openWhenMissing: boolean) => {
      const signal = requestController.current?.signal;
      if (!signal || signal.aborted) return;
      setLoading(true);
      void load(signal, openWhenMissing);
    },
    [load]
  );
  const retry = useCallback(() => reloadForm(true), [reloadForm]);
  useEffect(() => {
    if (!isWeb) return;
    const refreshAfterBrowser = () => {
      if (externalViewerHandoff.current !== handoffId) return;
      externalViewerHandoff.current = null;
      reloadForm(false);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshAfterBrowser();
    };
    window.addEventListener('focus', refreshAfterBrowser);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshAfterBrowser);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [handoffId, reloadForm]);
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
      Keyboard.dismiss();
      setValues({});
      if (isWeb) {
        externalViewerHandoff.current = handoffId;
        await openBrowserViewerWindow(viewerUrl);
      } else {
        setLiveViewer({
          url: await authorizeBrowserViewer(viewerUrl),
          handoffId,
        });
      }
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, [resolve, handoffId]);

  const closeBrowser = useCallback(() => {
    setLiveViewer(undefined);
    // Refresh after human navigation without reopening a dismissed viewer.
    reloadForm(false);
  }, [reloadForm]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      {liveViewer?.handoffId === handoffId ? (
        <BrowserViewerModal viewerUrl={liveViewer.url} onClose={closeBrowser} />
      ) : null}
      <ScreenHeader
        borderBottom
        backAction={dismiss}
        title={approvingSavedLogin ? 'Approve sign-in' : 'Secure browser form'}
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
            ) : handoff && approvingSavedLogin ? (
              <>
                <Text size="$label/l" fontWeight="600">
                  Approve sign-in to {new URL(handoff.origin).hostname}?
                </Text>
                <Text color="$secondaryText">{handoff.origin}</Text>
                <Text>
                  Your bot is asking to use a saved login for this sign-in.
                </Text>
                {!vaultEligible ? (
                  <Text color="$negativeActionText">
                    This page cannot use a saved login. Cancel and ask your bot
                    to open the sign-in page.
                  </Text>
                ) : vaultError ? (
                  <Text color="$negativeActionText">{vaultError}</Text>
                ) : !vaultAuth ? (
                  <Text color="$secondaryText">Loading saved login…</Text>
                ) : (
                  <YStack gap="$m">
                    {vaultAuth.accounts
                      .filter(
                        (account) =>
                          !loginApproval?.record ||
                          account.id === loginApproval.record.id
                      )
                      .map((account) => (
                        <YStack key={account.id} gap="$s">
                          {vaultAuth.accounts.length === 1 ||
                          loginApproval?.record ? (
                            <Text size="$label/l" fontWeight="600">
                              {account.label}
                            </Text>
                          ) : (
                            <Button
                              preset="secondary"
                              label={`${choice?.record.id === account.id ? 'Selected: ' : ''}${account.label}`}
                              disabled={submitting}
                              onPress={() =>
                                setChoice({
                                  mode: 'use',
                                  record: {
                                    id: account.id,
                                    revision: account.revision,
                                  },
                                })
                              }
                            />
                          )}
                          {account.username ? (
                            <Text>{account.username}</Text>
                          ) : null}
                        </YStack>
                      ))}
                    <Text color="$secondaryText">
                      Your password stays hidden. Approval allows this sign-in
                      only.
                    </Text>
                  </YStack>
                )}
                {error ? (
                  <Text color="$negativeActionText">{error}</Text>
                ) : null}
                <Button
                  preset="primary"
                  label="Approve sign-in"
                  centered
                  loading={submitting}
                  disabled={submitting || !canSubmit}
                  onPress={fillAndSubmit}
                />
                <Button
                  preset="secondary"
                  label="Cancel"
                  centered
                  disabled={submitting}
                  onPress={dismiss}
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
                  These fields go directly to the live browser. They are not
                  posted to chat.
                </Text>
                {handoff.kind === 'details' ? (
                  <Text color="$secondaryText">
                    Filling these fields does not submit a payment or place an
                    order.
                  </Text>
                ) : null}
                {vaultEligible && !showSavedLogins ? (
                  <Button
                    preset="secondary"
                    label="Use saved login"
                    disabled={submitting}
                    onPress={() => {
                      setShowSavedLogins(true);
                      setVaultRequested(true);
                    }}
                  />
                ) : null}
                {showSavedLogins &&
                vaultEligible &&
                !vaultAuth &&
                !vaultError ? (
                  <Text color="$secondaryText">Loading saved logins…</Text>
                ) : null}
                {showSavedLogins && vaultAuth?.accounts.length ? (
                  <YStack gap="$s">
                    <Text>Saved logins</Text>
                    {vaultAuth.accounts.map((account) => (
                      <YStack key={account.id} gap="$s">
                        {account.username ? (
                          <Text>{account.username}</Text>
                        ) : null}
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
                            setAllowAutomatic(account.permission === 'allow');
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
                            setAllowAutomatic(account.permission === 'allow');
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
                        setShowSavedLogins(false);
                        setChoice(undefined);
                        setSaveLogin(false);
                        setAllowAutomatic(false);
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
                    <XStack alignItems="center" gap="$m" minHeight={48}>
                      <Text flex={1}>Save login for this bot</Text>
                      <Switch
                        accessibilityLabel="Save login for this bot"
                        value={saveLogin}
                        disabled={submitting}
                        onValueChange={(save) => {
                          setVaultRequested(true);
                          setSaveLogin(save);
                        }}
                      />
                    </XStack>
                    {saveLogin ? (
                      <>
                        <Text color="$secondaryText">
                          Save this login for {handoff.origin}. You control
                          whether this bot needs to ask before using it.
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
                {vaultEligible && (saveLogin || choice?.mode === 'use') ? (
                  <XStack alignItems="center" gap="$m" minHeight={48}>
                    <YStack flex={1} gap="$s">
                      <Text>Always allow this bot to sign in</Text>
                      <Text color="$secondaryText">
                        {allowAutomatic
                          ? 'Your bot can use this login without asking.'
                          : 'Your bot must ask before using this saved login.'}
                      </Text>
                    </YStack>
                    <Switch
                      accessibilityLabel="Allow automatic sign-in"
                      value={allowAutomatic}
                      disabled={submitting}
                      onValueChange={setAllowAutomatic}
                    />
                  </XStack>
                ) : null}
                {choice?.mode === 'use' ? (
                  <Text>
                    {allowAutomatic
                      ? 'Allow sign-in and future automatic use.'
                      : 'Continue allows this sign-in only.'}
                  </Text>
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
                {choice?.mode === 'use' ? (
                  <Button
                    preset="secondary"
                    label="Deny"
                    disabled={submitting}
                    onPress={dismiss}
                  />
                ) : null}
              </>
            ) : (
              <>
                <Text
                  color={
                    noSecureForm && !error
                      ? '$secondaryText'
                      : '$negativeActionText'
                  }
                >
                  {error ??
                    (noSecureForm
                      ? 'Continue in the live browser.'
                      : 'Could not find a supported browser form.')}
                </Text>
                <Button
                  preset="secondary"
                  label={noSecureForm ? 'Check for secure form' : 'Try again'}
                  centered
                  onPress={retry}
                />
              </>
            )}
          </YStack>
          {!loading &&
          !submitting &&
          !returning &&
          !filled &&
          (!approvingSavedLogin || approved) ? (
            <YStack gap="$m">
              <Button
                preset="secondary"
                label="Open live browser"
                centered
                onPress={openBrowser}
              />
              <Text color="$secondaryText">
                {isWeb
                  ? 'The browser opens in a new tab. Return here when you’re done.'
                  : 'Complete any additional steps here, then continue the task.'}
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
