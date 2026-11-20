import { useState } from 'react';
import { Spinner, XStack } from 'tamagui';

import {
  A2UICardButton,
  A2UI_SPACE,
} from '../../ui/components/PostContent/a2uiCardParts';
import { BrowserCardFrame, BrowserCardText } from './BrowserCardFrame';
import { BrowserPaymentCard, BrowserPaymentSheet } from './BrowserPayment';
import { BrowserWalletConnectCard } from './BrowserWalletConnectCard';
import { useBrowserWallet } from './useBrowserWallet';

export function BrowserWalletCard({
  requestId,
  botMoon,
}: {
  requestId: string;
  botMoon?: string;
}) {
  const [open, setOpen] = useState(false);
  const wallet = useBrowserWallet(requestId, botMoon, open);
  return (
    <>
      {wallet.view?.connection_mode === 'tlon_oauth' ? (
        <BrowserWalletConnectCard
          view={wallet.view}
          onOpenLink={wallet.onOpenLink}
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
        <BrowserCardFrame icon="Lock" kicker="Tlon wallet">
          <BrowserCardText
            type="title"
            color="$primaryText"
            marginTop={A2UI_SPACE.afterKicker}
          >
            Payment request
          </BrowserCardText>
          {wallet.error ? (
            <>
              <BrowserCardText type="body" marginTop={A2UI_SPACE.line}>
                {wallet.error}
              </BrowserCardText>
              <XStack paddingTop={A2UI_SPACE.beforeButtons}>
                <A2UICardButton
                  tone="primary"
                  label="Try again"
                  onPress={wallet.onRetry}
                />
              </XStack>
            </>
          ) : (
            <Spinner alignSelf="flex-start" marginTop={A2UI_SPACE.block} />
          )}
        </BrowserCardFrame>
      )}
      {open ? (
        <BrowserPaymentSheet {...wallet} open onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
