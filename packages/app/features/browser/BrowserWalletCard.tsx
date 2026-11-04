import { useState } from 'react';
import { Button, Text } from '@tloncorp/ui';
import { Spinner, YStack } from 'tamagui';
import { BrowserPaymentCard, BrowserPaymentSheet } from './BrowserPayment';
import { BrowserWalletConnectCard } from './BrowserWalletConnectCard';
import { useBrowserWallet } from './useBrowserWallet';

export function BrowserWalletCard({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const wallet = useBrowserWallet(requestId, open);
  return (
    <>
      {wallet.view?.connection_mode === 'tlon_oauth' ? (
        <BrowserWalletConnectCard
          view={wallet.view}
          walletError={wallet.error}
          onRetry={wallet.onRetry}
        />
      ) : wallet.view ? (
        <BrowserPaymentCard
          view={wallet.view}
          error={wallet.error}
          onOpenLink={wallet.onOpenLink}
          onOpen={() => setOpen(true)}
        />
      ) : (
        <YStack padding="$l" gap="$m" width="100%" maxWidth={400}>
          <Text size="$label/l">Payment request</Text>
          {wallet.error ? (
            <>
              <Text>{wallet.error}</Text>
              <Button label="Try again" onPress={wallet.onRetry} />
            </>
          ) : (
            <Spinner />
          )}
        </YStack>
      )}
      {open ? (
        <BrowserPaymentSheet {...wallet} open onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
