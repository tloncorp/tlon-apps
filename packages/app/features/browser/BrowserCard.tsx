import type { BrowserCardData } from '@tloncorp/api/client/browserCards';
import type { BrowserCardBlockData } from '@tloncorp/api/client/postContent';
import { createDevLogger } from '@tloncorp/shared';
import { Button, Icon, Text, useToast } from '@tloncorp/ui';
import { useRef, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { useContentContext } from '../../ui/components/PostContent/contentUtils';
import { useOptionalBrowserCredentialHandoff } from './BrowserCredentialHandoffContext';
import {
  BrowserSessionAction,
  BrowserSessionPreview,
} from './BrowserSessionPreview';
import { trustedBrowserViewerUrl } from './browserCredentialHandoff';

const logger = createDevLogger('BrowserCard', false);

export function BrowserCardBlock({ block }: { block: BrowserCardBlockData }) {
  const { canUseBrowserCards } = useContentContext();
  return (
    <BrowserCard card={block.card} allowed={canUseBrowserCards === true} />
  );
}

/** One renderer for live posts and design fixtures, on both native and web. */
export function BrowserCard({
  card,
  allowed,
}: {
  card: BrowserCardData;
  allowed: boolean;
}) {
  const handoff = useOptionalBrowserCredentialHandoff();
  const showToast = useToast();
  const [pending, setPending] = useState(false);
  const opening = useRef(false);
  const session = card.type === 'browser-session';
  const approval = !session && card.loginApproval;
  const login = !session && card.presentation?.purpose === 'login';
  const otp = !session && card.presentation?.purpose === 'otp';
  const title = session
    ? 'Browser session'
    : approval
      ? 'Approve saved sign-in'
      : login
        ? 'Secure Vault'
        : otp
          ? 'Verification code'
          : 'Secure entry';
  const description = session
    ? 'View and control the shared browser.'
    : approval
      ? 'Approve this sign-in using a saved login.'
      : login
        ? 'Use your vault to store your site logins securely.'
        : otp
          ? 'Send your verification code directly to the browser. It won’t be saved to your vault.'
          : 'Your input goes directly to the browser. It’s never visible to your Tlonbot.';
  const label = session
    ? 'Open browser'
    : approval
      ? 'Review'
      : login
        ? 'Add'
        : otp
          ? 'Enter code'
          : 'Continue';
  let valid = false;
  try {
    trustedBrowserViewerUrl(card.viewerUrl);
    valid = true;
  } catch {
    // Post blobs are untrusted; only configured viewer origins can be opened.
  }
  const enabled = allowed && valid && !!handoff;

  const open = async () => {
    if (!enabled || opening.current) return;
    opening.current = true;
    setPending(true);
    logger.trackEvent('browser_card_open', { kind: card.type });
    try {
      if (session) await handoff.openViewer(card.viewerUrl);
      else handoff.openForm(card.viewerUrl, card.loginApproval);
      logger.trackEvent('browser_card_opened', { kind: card.type });
    } catch {
      // Errors can contain signed viewer links; do not log their raw text.
      logger.trackError('browser_card_open_failed', { kind: card.type });
      showToast({ message: 'Couldn’t open the browser. Please try again.' });
    } finally {
      opening.current = false;
      setPending(false);
    }
  };
  const action = (
    <Button
      fill="solid"
      intent="primary"
      disabled={!enabled || pending}
      onPress={open}
      testID="browser-card-open"
      label={pending ? 'Opening…' : label}
    />
  );

  return (
    <YStack
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      backgroundColor="$secondaryBackground"
      padding="$l"
      gap="$m"
      maxWidth={400}
      width="100%"
    >
      {session && enabled ? (
        <BrowserSessionPreview viewerUrl={card.viewerUrl} onOpen={open} />
      ) : null}
      <XStack gap="$m" alignItems="center">
        {!session ? (
          <Icon type="Lock" customSize={['$xl', '$xl']} color="$primaryText" />
        ) : null}
        <YStack gap="$xs" flex={1}>
          <Text size="$label/l">{title}</Text>
          {!session && card.presentation?.site ? (
            <Text size="$label/s" color="$secondaryText">
              {card.presentation.site}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      <Text color="$secondaryText">{description}</Text>
      {session ? (
        <BrowserSessionAction viewerUrl={card.viewerUrl}>
          {action}
        </BrowserSessionAction>
      ) : (
        action
      )}
    </YStack>
  );
}
