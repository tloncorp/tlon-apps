import {
  walletViewSchema,
  type WalletView,
} from '@tloncorp/api/client/browserWallet';
import { Button, Text } from '@tloncorp/ui';
import { getConfiguredShipUrl } from '@tloncorp/api/client/urbit';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Switch } from 'react-native';
import { walletActionRequest, walletActionUrl } from './browserWalletRequest';
import { View, YStack, isWeb } from 'tamagui';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';

function displayAmount(amount: number, currency: string) {
  const format = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'code',
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** digits);
}

type Props = {
  navigation: { goBack(): void };
  route: { params: { requestId: string } };
};
const finished = new Set([
  'connected',
  'ready',
  'filled',
  'cancelled',
  'expired',
  'failed',
  'unknown',
]);

/** The same-origin owner bridge authenticates the ship; the bot has no owner key. */
export function BrowserWalletScreen({ navigation, route }: Props) {
  const { requestId } = route.params;
  const [view, setView] = useState<WalletView>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const providerSheet = useRef(false);
  const shipUrl = isWeb ? window.location.origin : getConfiguredShipUrl();
  useEffect(() => {
    if (
      view &&
      finished.has(view.status) &&
      providerSheet.current &&
      Platform.OS === 'ios'
    ) {
      WebBrowser.dismissAuthSession();
    }
  }, [view]);
  useEffect(
    () => () => {
      if (providerSheet.current && Platform.OS === 'ios')
        WebBrowser.dismissAuthSession();
    },
    []
  );
  const request = useCallback(
    async (operation = 'view', body = {}, signal?: AbortSignal) => {
      const response = await walletActionRequest({
        shipUrl,
        requestId,
        operation,
        body,
        signal,
        native: !isWeb,
      });
      if (!response.ok) {
        if (response.status === 401)
          throw new Error(
            'Sign in to the owner ship to open this wallet request.'
          );
        throw new Error(
          'Wallet request unavailable. Check the service and try again.'
        );
      }
      const next = walletViewSchema.parse(await response.json());
      setView(next);
      return next;
    },
    [requestId, shipUrl]
  );
  const perform = useCallback(
    async (operation = 'view', body = {}) => {
      setBusy(true);
      setError('');
      try {
        return await request(operation, body);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Wallet request failed.');
      } finally {
        setBusy(false);
      }
    },
    [request]
  );
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await request('view', {}, controller.signal);
        setError('');
        if (finished.has(next.status)) return;
      } catch {
        if (!controller.signal.aborted)
          setError('Unable to refresh this wallet request. You can try again.');
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 4000);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [request]);
  const openProvider = async () => {
    // Read the current action on each click. A stale consent URL is never retained in chat.
    const popup = isWeb ? window.open('about:blank', '_blank') : undefined;
    if (popup) popup.opener = null;
    const next = await perform();
    try {
      if (!next?.action) throw new Error('There is no pending Link action.');
      const url = new URL(next.action.url);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('Invalid Link action.');
      if (popup) popup.location.replace(url.href);
      else if (Platform.OS === 'ios') {
        providerSheet.current = true;
        try {
          await WebBrowser.openAuthSessionAsync(url.href, undefined, {
            preferEphemeralSession: false,
          });
        } finally {
          providerSheet.current = false;
        }
      } else {
        await WebBrowser.openBrowserAsync(url.href);
      }
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : 'Unable to open Link.');
    }
  };
  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={() => navigation.goBack()}
        title="Tlon wallet"
      />
      <SettingsContentScrollView paddingHorizontal="$l" paddingTop="$l">
        <YStack gap="$l" maxWidth={640} width="100%" alignSelf="center">
          {error ? <Text>{error}</Text> : null}
          {!view ? (
            <Text>Loading wallet request…</Text>
          ) : (
            <>
              <Text>
                {view.kind === 'connect'
                  ? 'Connect Link to your Tlon wallet'
                  : 'Review payment request'}
              </Text>
              <Text>Status: {view.status}</Text>
              {view.kind === 'connect' ? (
                <Text>
                  Connect your Link account in the window that opens. Payment
                  details stay with Link and Kernel. Connecting does not approve
                  any purchase.
                </Text>
              ) : null}
              {view.purchase ? (
                <YStack gap="$m">
                  <Text>{view.purchase.merchant}</Text>
                  <Text>{view.purchase.page_url}</Text>
                  <Text>
                    {displayAmount(
                      view.purchase.amount,
                      view.purchase.currency
                    )}
                  </Text>
                  <Text>{view.purchase.description}</Text>
                  <Text>
                    Compare these requested details with the live checkout below
                    before approving.
                  </Text>
                  {isWeb ? (
                    <img
                      alt="Current checkout"
                      style={{ width: '100%' }}
                      src={`/apps/browser-wallet/actions/${requestId}/preview`}
                    />
                  ) : (
                    <Image
                      accessibilityLabel="Current checkout"
                      source={{
                        uri: walletActionUrl(shipUrl, requestId, 'preview'),
                      }}
                      style={{ width: '100%', height: 240 }}
                      resizeMode="contain"
                    />
                  )}
                </YStack>
              ) : null}
              {view.status === 'review' ? (
                <>
                  {(view.payment_methods || []).map((method) => (
                    <Button
                      key={method.id}
                      preset="secondary"
                      label={`${selected === method.id ? '✓ ' : ''}${method.display}`}
                      onPress={() => setSelected(method.id)}
                    />
                  ))}
                  {!view.payment_methods?.length ? (
                    <Text>No eligible payment methods are available.</Text>
                  ) : null}
                  <Text>
                    I checked the merchant, items, currency and total against
                    the checkout and approve this payment request.
                  </Text>
                  <Switch value={confirmed} onValueChange={setConfirmed} />
                  <Button
                    preset="primary"
                    label="Request approval from Link"
                    disabled={busy || !confirmed || !selected}
                    onPress={() =>
                      void perform('approve', {
                        confirmed: true,
                        payment_method_id: selected,
                      })
                    }
                  />
                </>
              ) : null}
              {view.action ? (
                <Button
                  preset="primary"
                  label="Continue with Link"
                  disabled={busy}
                  onPress={() => void openProvider()}
                />
              ) : null}
              {finished.has(view.status) ? (
                <Text>
                  {view.status === 'connected'
                    ? 'Link is connected. Your bot will be notified.'
                    : view.status === 'ready'
                      ? 'Payment approved. Your bot can fill this checkout. No purchase has been submitted.'
                      : view.status === 'filled'
                        ? 'The checkout was filled. This is not a purchase confirmation.'
                        : view.status === 'unknown'
                          ? 'The result is uncertain. Inspect the existing payment before retrying.'
                          : 'This request has ended. Your bot will be notified.'}
                </Text>
              ) : null}
            </>
          )}
          <Button
            preset="secondary"
            label="Check status"
            disabled={busy}
            onPress={() => void perform()}
          />
          {view && !finished.has(view.status) ? (
            <Button
              preset="secondary"
              label="Cancel request"
              disabled={busy}
              onPress={() => void perform('cancel')}
            />
          ) : null}
        </YStack>
      </SettingsContentScrollView>
    </View>
  );
}
