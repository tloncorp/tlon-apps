import type { WalletView } from '@tloncorp/api/client/browserWallet';
import { Icon } from '@tloncorp/ui';
import { XStack, YStack } from 'tamagui';

import {
  A2UICardButton,
  A2UI_SPACE,
} from '../../ui/components/PostContent/a2uiCardParts';
import { BrowserCardFrame, BrowserCardText } from './BrowserCardFrame';
import { walletFinished } from './browserPaymentPresentation';

export function BrowserWalletConnectCard({
  view,
  walletError,
  onRetry,
  onOpenLink,
}: {
  view: WalletView;
  walletError?: string;
  onRetry?: () => void;
  onOpenLink(): void;
}) {
  const missingLink = !walletFinished.has(view.status) && !view.action;
  return (
    <BrowserWalletConnectContent
      view={view}
      error={
        missingLink
          ? 'This connection link is unavailable. Ask your bot for a new one.'
          : undefined
      }
      walletError={walletError}
      onRetry={onRetry}
      busy={missingLink}
      onConnect={onOpenLink}
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
    <BrowserCardFrame icon="Lock" kicker="Tlon wallet">
      <BrowserCardText
        type="title"
        color="$primaryText"
        marginTop={A2UI_SPACE.afterKicker}
      >
        {view.status === 'connected'
          ? 'Wallet connected'
          : 'Give Tlonbot a wallet'}
      </BrowserCardText>
      <BrowserCardText type="body" marginTop={A2UI_SPACE.line}>
        {view.status === 'connected'
          ? 'Your Tlonbot can continue. Each payment needs your approval.'
          : ended
            ? 'This connection request has ended. Ask your bot for a new one.'
            : 'Add a payment method and Tlonbot can complete checkouts for you.'}
      </BrowserCardText>
      {!ended ? (
        <YStack marginTop={A2UI_SPACE.block} gap={A2UI_SPACE.line}>
          <Reassurance>
            Nothing is charged until you approve a payment request.
          </Reassurance>
          <Reassurance>
            Your card details stay with Stripe and are never visible in Tlon.
          </Reassurance>
        </YStack>
      ) : null}
      {error || walletError ? (
        <YStack marginTop={A2UI_SPACE.block} gap={A2UI_SPACE.line}>
          {error ? (
            <BrowserCardText type="note" color="$negativeActionText">
              {error}
            </BrowserCardText>
          ) : null}
          {walletError ? (
            <BrowserCardText type="note" color="$negativeActionText">
              {walletError}
            </BrowserCardText>
          ) : null}
        </YStack>
      ) : null}
      {walletError || !ended ? (
        <XStack gap={8} paddingTop={A2UI_SPACE.beforeButtons}>
          {walletError ? (
            <A2UICardButton
              tone="secondary"
              label="Try again"
              onPress={onRetry}
            />
          ) : null}
          {!ended ? (
            <A2UICardButton
              tone="primary"
              label="Connect Stripe Link"
              disabled={busy}
              onPress={onConnect}
            />
          ) : null}
        </XStack>
      ) : null}
    </BrowserCardFrame>
  );
}

function Reassurance({ children }: { children: string }) {
  return (
    <XStack gap={8} alignItems="flex-start">
      <Icon
        type="Checkmark"
        color="$secondaryText"
        customSize={[14, 14]}
        marginTop={2}
      />
      <BrowserCardText type="note" flex={1}>
        {children}
      </BrowserCardText>
    </XStack>
  );
}
