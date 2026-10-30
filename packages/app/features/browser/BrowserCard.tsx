import type { BrowserCardData } from '@tloncorp/api/client/browserCards';
import type { BrowserCardBlockData } from '@tloncorp/api/client/postContent';
import { createDevLogger } from '@tloncorp/shared';
import { Icon, Text, useToast } from '@tloncorp/ui';
import { useRef, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { ReferenceSkeleton } from '../../ui/components/ContentReference/Reference';
import {
  A2UICardButton,
  A2UI_CARD_PADDING,
  A2UI_CARD_PADDING_TOP,
  A2UI_CARD_RADIUS,
  A2UI_SPACE,
  A2UI_TEXT_BREAKING,
  A2UI_TYPE,
} from '../../ui/components/PostContent/a2uiCardParts';
import { useContentContext } from '../../ui/components/PostContent/contentUtils';
import { useOptionalBrowserCredentialHandoff } from './BrowserCredentialHandoffContext';
import {
  BrowserSessionAction,
  BrowserSessionPreview,
} from './BrowserSessionPreview';
import { trustedBrowserViewerUrl } from './browserCredentialHandoff';

import { BrowserSecureEntryAction } from './BrowserSecureEntryAction';

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
  if (!allowed) {
    return (
      <ReferenceSkeleton
        messageType="not-found"
        message="This message isn’t visible to you."
        maxWidth={400}
        width="100%"
      />
    );
  }
  const session = card.type === 'browser-session';
  const approval = !session && card.loginApproval;
  const login = !session && card.presentation?.purpose === 'login';
  const otp = !session && card.presentation?.purpose === 'otp';
  const kicker = session
    ? 'Browser'
    : approval
      ? 'Saved sign-in'
      : 'Secure input';
  const title = session
    ? 'Browser Use'
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
  // The gap above the button travels with it, so a card whose action is
  // hidden (an ended session, a finished entry) ends at the card's padding.
  const action = (
    <XStack paddingTop={A2UI_SPACE.beforeButtons}>
      <A2UICardButton
        tone="primary"
        disabled={!enabled || pending}
        onPress={open}
        testID="browser-card-open"
        label={pending ? 'Opening…' : label}
      />
    </XStack>
  );

  return (
    <YStack
      width="100%"
      maxWidth={560}
      backgroundColor="$background"
      borderWidth={1}
      borderColor="$border"
      borderRadius={A2UI_CARD_RADIUS}
      overflow="hidden"
    >
      {session && enabled ? (
        <BrowserSessionPreview viewerUrl={card.viewerUrl} onOpen={open} />
      ) : null}
      <YStack
        paddingTop={A2UI_CARD_PADDING_TOP}
        paddingHorizontal={A2UI_CARD_PADDING}
        paddingBottom={A2UI_CARD_PADDING}
      >
        <XStack alignItems="center" gap={6}>
          <Icon
            type={session ? 'Discover' : 'Lock'}
            color="$secondaryText"
            customSize={[14, 14]}
          />
          <Text
            size="$label/m"
            {...A2UI_TYPE.kicker}
            color="$secondaryText"
            trimmed={false}
          >
            {kicker}
          </Text>
        </XStack>
        <Text
          size="$label/l"
          {...A2UI_TYPE.title}
          color="$primaryText"
          trimmed={false}
          marginTop={A2UI_SPACE.afterKicker}
          {...A2UI_TEXT_BREAKING}
        >
          {title}
        </Text>
        {!session && card.presentation?.site ? (
          <Text
            size="$label/m"
            {...A2UI_TYPE.note}
            color="$secondaryText"
            trimmed={false}
            numberOfLines={1}
            marginTop={A2UI_SPACE.line}
          >
            {card.presentation.site}
          </Text>
        ) : null}
        <Text
          size="$label/l"
          {...A2UI_TYPE.body}
          color="$secondaryText"
          trimmed={false}
          marginTop={A2UI_SPACE.line}
          {...A2UI_TEXT_BREAKING}
        >
          {description}
        </Text>
        {session ? (
          <BrowserSessionAction viewerUrl={card.viewerUrl}>
            {action}
          </BrowserSessionAction>
        ) : enabled ? (
          <BrowserSecureEntryAction
            viewerUrl={card.viewerUrl}
            enabled={enabled}
          >
            {action}
          </BrowserSecureEntryAction>
        ) : (
          action
        )}
      </YStack>
    </YStack>
  );
}
