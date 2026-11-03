import type { WalletView } from '@tloncorp/api/client/browserWallet';
import { Button, Icon, Text } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { YStack } from 'tamagui';

import { useMcpConnections } from '../settings/useMcpConnections';
import { walletFinished } from './browserPaymentPresentation';

export function BrowserWalletConnectCard({
  view,
  walletError,
  onRetry,
}: {
  view: WalletView;
  walletError?: string;
  onRetry?: () => void;
}) {
  const [error, setError] = useState('');
  const connections = useMcpConnections({
    onEvent: (event) => {
      if (event.type === 'start-failed')
        setError('Couldn’t open Stripe Link. Try again.');
      else if (event.type === 'completed' && !event.success)
        setError(event.message);
    },
  });
  const { refreshStatus } = connections;
  const ended = walletFinished.has(view.status);
  useEffect(() => {
    if (!ended) void refreshStatus();
  }, [ended, refreshStatus]);

  const connect = async () => {
    setError('');
    const provider = connections.providerConfigs.find(
      (entry) => entry.template === 'link'
    );
    if (!provider) {
      setError('Stripe Link is unavailable. Try again shortly.');
      void connections.refreshStatus();
      return;
    }
    const result = await connections.connect(provider.id);
    if (result === 'unavailable')
      setError('Sign in to Tlon hosting to connect Stripe Link.');
  };
  return (
    <BrowserWalletConnectContent
      view={view}
      error={error}
      walletError={walletError}
      onRetry={onRetry}
      busy={connections.initialLoading || !!connections.busyProviderId}
      onConnect={() => void connect()}
    />
  );
}

export function BrowserWalletConnectContent({
  view,
  error,
  busy,
  onConnect,
  walletError,
  onRetry,
}: {
  view: WalletView;
  error?: string;
  busy?: boolean;
  onConnect(): void;
  walletError?: string;
  onRetry?: () => void;
}) {
  const ended = walletFinished.has(view.status);
  return (
    <YStack
      width="100%"
      maxWidth={400}
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      backgroundColor="$background"
      overflow="hidden"
    >
      <YStack padding="$l" gap="$m" alignItems="center">
        <Icon type="Lock" />
        <Text size="$label/l">
          {view.status === 'connected'
            ? 'Wallet connected'
            : 'Give Tlonbot a wallet'}
        </Text>
        <Text color="$secondaryText">
          {view.status === 'connected'
            ? 'Your Tlonbot can continue. Each payment needs your approval.'
            : ended
              ? 'This connection request has ended. Ask your bot for a new one.'
              : 'Add a payment method and Tlonbot can complete checkouts for you.'}
        </Text>
        {!ended ? (
          <>
            <Text>Nothing is charged until you approve a payment request.</Text>
            <Text>
              Your card details stay with Stripe and are never visible in Tlon.
            </Text>
          </>
        ) : null}
        {error ? <Text color="$negativeActionText">{error}</Text> : null}
        {walletError ? (
          <>
            <Text color="$negativeActionText">{walletError}</Text>
            <Button label="Try again" onPress={onRetry} />
          </>
        ) : null}
      </YStack>
      {!ended ? (
        <YStack borderTopWidth={1} borderColor="$border" padding="$l">
          <Button
            fill="solid"
            intent="primary"
            label={busy ? 'Opening Stripe Link…' : 'Connect Stripe Link'}
            disabled={busy}
            onPress={onConnect}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}
