import type {
  BrowserLoginChoice,
  SavedBrowserLogin,
} from '@tloncorp/api/client/browserVault';
import { createDevLogger } from '@tloncorp/shared';
import { Button, Icon, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { View, XStack, YStack, isWeb } from 'tamagui';

import type { BrowserCredentialHandoffParams } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';
import {
  type BrowserCredentialHandoff,
  BrowserFormError,
  authorizeBrowserLogins,
  authorizeBrowserViewer,
  beginBrowserCredentialHandoff,
  cancelBrowserCredentialHandoff,
  submitBrowserCredentials,
  supportsSavedLogins,
  trustedBrowserViewerUrl,
  validBrowserFormValues,
} from './browserCredentialHandoff';
import { openBrowserViewerWindow } from './browserViewerWindow';
import { useBrowserCredentialHandoff } from './BrowserCredentialHandoffProvider';
import { BrowserViewerModal } from './BrowserViewerModal';
import { BrowserSecureFields } from './BrowserSecureFields';

type Props = {
  navigation: { goBack(): void; isFocused(): boolean };
  route: { params: BrowserCredentialHandoffParams };
};

const logger = createDevLogger('BrowserCredentialHandoffScreen', false);

const SAVE_NOTICES = {
  saved: 'Login saved for this bot.',
  pending: 'Login saving continues in the next secure step.',
  failed: 'Your login was entered, but could not be saved.',
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Could not connect to the browser form.';
}

export function BrowserCredentialHandoffScreen({ navigation, route }: Props) {
  const loginApproval = route.params.loginApproval;
  const [handoff, setHandoff] = useState<BrowserCredentialHandoff>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [filled, setFilled] = useState(false);
  const [noSecureForm, setNoSecureForm] = useState(false);
  const [liveViewer, setLiveViewer] = useState<{
    url: string;
    handoffId: string;
  }>();
  const [error, setError] = useState<string>();
  const [ended, setEnded] = useState(false);
  const [authorization, setAuthorization] = useState<{
    fillUrl: string;
    grant: string;
    accounts: SavedBrowserLogin[];
  }>();
  const [vaultError, setVaultError] = useState<string>();
  const [enteringNewLogin, setEnteringNewLogin] = useState(false);
  const [choice, setChoice] = useState<{
    mode: 'use' | 'update';
    record: BrowserLoginChoice;
  }>();
  const [saveStatus, setSaveStatus] = useState<keyof typeof SAVE_NOTICES>();
  const saveNotice = saveStatus ? SAVE_NOTICES[saveStatus] : undefined;
  const { resolve, discard } = useBrowserCredentialHandoff();
  const handoffId = route.params.handoffId;
  const activeHandoffs = useRef(new Set<string>());
  const outcomes = useRef(new Map<string, 'completed' | 'canceled'>());
  const externalViewerHandoff = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const requestController = useRef<AbortController | undefined>(undefined);
  const vaultEligible = !!handoff?.vault && supportsSavedLogins(handoff);
  const approvingSavedLogin = !!loginApproval;
  const vaultAuth =
    vaultEligible && authorization?.fillUrl === handoff?.fillUrl
      ? authorization
      : undefined;
  const usernameField = handoff?.fields.find(
    (field) => field.purpose === 'username'
  );
  const saveLabel =
    (usernameField ? values[usernameField.id]?.slice(0, 256) : undefined) ||
    vaultAuth?.accounts.find((account) => account.id === choice?.record.id)
      ?.label ||
    (handoff ? new URL(handoff.origin).hostname : undefined);
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
    (!vaultEligible || !!vaultAuth);

  const clearSavedLoginSelection = useCallback(() => {
    setSaveStatus((status) => (status === 'pending' ? undefined : status));
    setChoice(undefined);
    setEnteringNewLogin(false);
  }, []);

  useEffect(() => {
    setAuthorization(undefined);
    if (!handoff || !vaultEligible) return;
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
          } else if (requested || !result.accounts.length) {
            setVaultError(
              'This saved login is no longer available. Cancel and ask your bot to check again.'
            );
          }
        } else if (result.accounts.length === 1) {
          const account = result.accounts[0];
          setChoice({
            mode: 'use',
            record: { id: account.id, revision: account.revision },
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          logger.trackError('Browser saved-login authorization failed');
          clearSavedLoginSelection();
          setVaultError(
            approvingSavedLogin
              ? 'Could not load the saved login. Cancel or try again.'
              : 'Could not connect to saved logins. Try again before entering your login.'
          );
        }
      });
    return () => controller.abort();
  }, [
    handoff,
    vaultEligible,
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
      setAttempted(false);
      clearSavedLoginSelection();
      setSaveStatus(undefined);
      setVaultError(undefined);
      setNoSecureForm(false);
      setError(undefined);
      setEnded(false);
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
          setHandoff(next);
        }
      } catch (nextError) {
        if (signal?.aborted) return;
        if (
          nextError instanceof BrowserFormError &&
          nextError.code !== 'handoff_complete' &&
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
          setEnded(
            nextError instanceof BrowserFormError &&
              (nextError.code === 'handoff_complete' ||
                nextError.status === 410)
          );
          setError(errorMessage(nextError));
        }
      }
      if (!signal?.aborted) setLoading(false);
    },
    [handoffId, resolve, clearSavedLoginSelection, loginApproval]
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
        if (!active.has(handoffId)) {
          discard(handoffId);
        }
      });
    };
  }, [discard, handoffId]);

  const finishHandoff = useCallback(() => {
    outcomes.current.set(handoffId, 'completed');
    discard(handoffId);
    if (activeHandoffs.current.has(handoffId) && navigation.isFocused())
      navigation.goBack();
  }, [discard, handoffId, navigation]);

  const fillFields = useCallback(async () => {
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
    setAttempted(true);
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await submitBrowserCredentials(
        handoff,
        {
          values: choice?.mode === 'use' ? undefined : values,
          submit: false,
          ...(vaultAuth ? { grant: vaultAuth.grant } : {}),
          ...(choice?.mode === 'use'
            ? { use: choice.record, allowAutomatic: false }
            : {}),
          ...(vaultEligible && choice?.mode !== 'use'
            ? {
                save: {
                  permission: 'ask',
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
      // The service reports this step to the agent, which inspects the page.
      outcomes.current.set(handoffId, 'completed');
      if (result.saveStatus) setSaveStatus(result.saveStatus);
      setFilled(true);
      if (result.saveStatus !== 'failed') finishHandoff();
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
    handoffId,
    finishHandoff,
    vaultAuth,
    choice,
    vaultEligible,
    saveLabel,
    canSubmit,
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
  const cancel = useCallback(async () => {
    if (submittingRef.current) return;
    if (outcomes.current.has(handoffId)) {
      dismiss();
      return;
    }
    const viewerUrl = resolve(handoffId);
    if (!viewerUrl) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await cancelBrowserCredentialHandoff(viewerUrl);
      outcomes.current.set(handoffId, 'canceled');
      if (activeHandoffs.current.has(handoffId)) dismiss();
    } catch {
      logger.trackError('Browser credential handoff cancellation failed');
      if (activeHandoffs.current.has(handoffId))
        setError('Could not cancel secure entry. Try again.');
    } finally {
      submittingRef.current = false;
      if (activeHandoffs.current.has(handoffId)) setSubmitting(false);
    }
  }, [dismiss, handoffId, resolve]);
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
        <YStack gap="$2xl" maxWidth={640} width="100%" alignSelf="center">
          <YStack
            backgroundColor="$background"
            borderColor="$border"
            borderWidth={1}
            borderRadius="$l"
            padding="$xl"
            $gtSm={{ padding: '$3xl' }}
            gap="$2xl"
          >
            {saveNotice ? (
              <Text color="$secondaryText">{saveNotice}</Text>
            ) : null}
            {loading ? (
              <Text color="$secondaryText">Finding the form…</Text>
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
                  onPress={finishHandoff}
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
                  <YStack gap="$m">
                    <Text color="$negativeActionText">{vaultError}</Text>
                    <Button
                      preset="secondary"
                      label="Try again"
                      onPress={retry}
                    />
                  </YStack>
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
                  label="Approve and fill"
                  centered
                  loading={submitting}
                  disabled={submitting || !canSubmit}
                  onPress={fillFields}
                />
                <Button
                  preset="secondary"
                  label="Cancel"
                  centered
                  disabled={submitting}
                  onPress={cancel}
                />
              </>
            ) : handoff ? (
              <>
                <YStack gap="$xl">
                  <XStack alignItems="center" gap="$l">
                    <Icon type="Lock" size="$xl" color="$primaryText" />
                    <YStack flex={1} minWidth={0} gap="$m">
                      <Text size="$label/m" color="$secondaryText">
                        {handoff.kind === 'login'
                          ? 'Sign in to'
                          : 'Enter details for'}
                      </Text>
                      <Text size="$label/3xl" fontWeight="600">
                        {new URL(handoff.origin).hostname}
                      </Text>
                    </YStack>
                  </XStack>
                  <Text size="$label/l" color="$secondaryText">
                    These fields go directly to the live browser. They are not
                    posted to chat.
                  </Text>
                  {handoff.kind === 'details' ? (
                    <Text size="$label/l" color="$secondaryText">
                      Filling these fields does not submit a payment or place an
                      order.
                    </Text>
                  ) : null}
                </YStack>
                {vaultEligible && !vaultAuth && !vaultError ? (
                  <Text color="$secondaryText">Loading saved logins…</Text>
                ) : null}
                {vaultAuth?.accounts.length ? (
                  <YStack gap="$s">
                    {enteringNewLogin ? (
                      <Button
                        preset="secondary"
                        label={
                          vaultAuth.accounts.length === 1
                            ? 'Use saved login'
                            : 'Choose saved login'
                        }
                        disabled={submitting}
                        onPress={() => {
                          setEnteringNewLogin(false);
                          const account =
                            vaultAuth.accounts.length === 1
                              ? vaultAuth.accounts[0]
                              : undefined;
                          setChoice(
                            account
                              ? {
                                  mode: 'use',
                                  record: {
                                    id: account.id,
                                    revision: account.revision,
                                  },
                                }
                              : undefined
                          );
                          setValues({});
                        }}
                      />
                    ) : (
                      <>
                        <Text>
                          {vaultAuth.accounts.length === 1
                            ? 'Saved login'
                            : 'Choose a saved login'}
                        </Text>
                        {vaultAuth.accounts.map((account) => (
                          <YStack key={account.id} gap="$s">
                            {vaultAuth.accounts.length === 1 ? (
                              <Text>{account.username || account.label}</Text>
                            ) : (
                              <Button
                                preset="secondary"
                                label={`${choice?.record.id === account.id ? 'Selected: ' : ''}${account.username || account.label}`}
                                disabled={submitting}
                                onPress={() => {
                                  setChoice({
                                    mode: 'use',
                                    record: {
                                      id: account.id,
                                      revision: account.revision,
                                    },
                                  });
                                  setValues({});
                                }}
                              />
                            )}
                            {choice?.record.id === account.id ? (
                              <Button
                                preset="secondary"
                                label={
                                  choice.mode === 'update'
                                    ? 'Use saved login'
                                    : `Update ${account.label}`
                                }
                                disabled={submitting}
                                onPress={() => {
                                  setChoice({
                                    mode:
                                      choice.mode === 'update'
                                        ? 'use'
                                        : 'update',
                                    record: {
                                      id: account.id,
                                      revision: account.revision,
                                    },
                                  });
                                  setValues({});
                                }}
                              />
                            ) : null}
                          </YStack>
                        ))}
                        <Button
                          preset="secondary"
                          label="Enter a new login"
                          disabled={submitting}
                          onPress={() => {
                            setEnteringNewLogin(true);
                            setChoice(undefined);
                            setValues({});
                          }}
                        />
                      </>
                    )}
                  </YStack>
                ) : null}
                {vaultError ? (
                  <YStack gap="$m">
                    <Text color="$negativeActionText">{vaultError}</Text>
                    <Button
                      preset="secondary"
                      label="Try again"
                      onPress={retry}
                    />
                  </YStack>
                ) : null}
                {!vaultEligible ||
                (vaultAuth &&
                  (!vaultAuth.accounts.length ||
                    enteringNewLogin ||
                    choice?.mode === 'update')) ? (
                  <BrowserSecureFields
                    fields={handoff.fields}
                    formId={handoff.formId}
                    values={values}
                    disabled={submitting}
                    showSections={handoff.kind === 'details'}
                    onChange={(id, value) =>
                      setValues((current) => ({ ...current, [id]: value }))
                    }
                    onSubmit={() => void fillFields()}
                  />
                ) : null}
                {vaultEligible ? (
                  <Text color="$secondaryText">
                    {choice?.mode === 'use'
                      ? 'Approval allows this sign-in only.'
                      : 'This login will be saved. Your bot must ask before using it to sign in again.'}
                  </Text>
                ) : null}
                {error ? (
                  <Text color="$negativeActionText">{error}</Text>
                ) : null}
                <Button
                  role="button"
                  tabIndex={submitting || !canSubmit ? -1 : 0}
                  onKeyDown={
                    isWeb
                      ? (event) => {
                          if (
                            !submitting &&
                            canSubmit &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault();
                            void fillFields();
                          }
                        }
                      : undefined
                  }
                  accessibilityRole="button"
                  focusable
                  preset="primary"
                  size="large"
                  label={
                    choice?.mode === 'use' ? 'Approve and fill' : 'Fill fields'
                  }
                  centered
                  loading={submitting}
                  disabled={submitting || !canSubmit}
                  onPress={fillFields}
                />
                {choice?.mode === 'use' ? (
                  <Button
                    preset="secondary"
                    label="Deny"
                    disabled={submitting}
                    onPress={cancel}
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
                  label={
                    attempted || ended
                      ? 'Return to conversation'
                      : noSecureForm
                        ? 'Check for secure form'
                        : 'Try again'
                  }
                  centered
                  onPress={attempted || ended ? dismiss : retry}
                />
              </>
            )}
          </YStack>
          {!loading &&
          !submitting &&
          !attempted &&
          !ended &&
          !filled &&
          !approvingSavedLogin ? (
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
                  : 'Close the live browser to return to secure entry.'}
              </Text>
              <Button
                preset="secondary"
                label="Cancel secure entry"
                disabled={submitting}
                centered
                onPress={cancel}
              />
            </YStack>
          ) : null}
        </YStack>
      </SettingsContentScrollView>
    </View>
  );
}
