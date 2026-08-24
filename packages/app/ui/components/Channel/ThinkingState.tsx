import type * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, Spinner, View, XStack } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import { useConversationComputingState } from './useConversationComputingState';

const MAX_VISIBLE_AVATARS = 3;

export function ThinkingState({
  conversationId,
  channelType,
  latestPostId,
  latestPostAuthorId,
  forcedLabel,
}: {
  conversationId: string;
  channelType: db.Channel['type'];
  latestPostId?: string;
  latestPostAuthorId?: string;
  forcedLabel?: string;
}) {
  const computingState = useConversationComputingState(conversationId);
  const [holdUntilResponse, setHoldUntilResponse] = useState(false);
  const postIdWhenThinkingStarted = useRef<string | undefined>(latestPostId);
  const expectedResponders = useRef<Set<string>>(new Set());
  const collapseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (computingState) {
      expectedResponders.current = new Set(
        computingState.ships.map((state) => state.ship)
      );
      if (!holdUntilResponse) {
        postIdWhenThinkingStarted.current = latestPostId;
        setHoldUntilResponse(true);
      }
      if (collapseTimeout.current) {
        clearTimeout(collapseTimeout.current);
        collapseTimeout.current = null;
      }
      return;
    }

    const responseHasArrived =
      holdUntilResponse &&
      latestPostId !== postIdWhenThinkingStarted.current &&
      (expectedResponders.current.size === 0 ||
        (latestPostAuthorId != null &&
          expectedResponders.current.has(latestPostAuthorId)));
    if (responseHasArrived) {
      if (collapseTimeout.current) {
        clearTimeout(collapseTimeout.current);
        collapseTimeout.current = null;
      }
      setHoldUntilResponse(false);
      return;
    }

    if (holdUntilResponse && !collapseTimeout.current) {
      collapseTimeout.current = setTimeout(() => {
        collapseTimeout.current = null;
        setHoldUntilResponse(false);
      }, 2_000);
    }
  }, [computingState, holdUntilResponse, latestPostAuthorId, latestPostId]);

  useEffect(() => {
    return () => {
      if (collapseTimeout.current) clearTimeout(collapseTimeout.current);
    };
  }, []);

  const responseHasArrived =
    holdUntilResponse &&
    latestPostId !== postIdWhenThinkingStarted.current &&
    (expectedResponders.current.size === 0 ||
      (latestPostAuthorId != null &&
        expectedResponders.current.has(latestPostAuthorId)));
  const visible =
    Boolean(forcedLabel) ||
    Boolean(computingState) ||
    (holdUntilResponse && !responseHasArrived);

  const showAvatars = Boolean(
    computingState && (channelType !== 'dm' || computingState.ships.length >= 2)
  );
  const visibleShips =
    computingState?.ships.slice(0, MAX_VISIBLE_AVATARS) ?? [];
  const overflowCount =
    (computingState?.ships.length ?? 0) - visibleShips.length;

  // Keep the footer mounted so presence changes do not replace the FlatList
  // footer in one frame. When a response arrives, remove its height in the same
  // render that adds the post; otherwise the list first closes this gap and
  // then scrolls again for the new row, producing a visible two-step bounce.
  return (
    <View
      accessibilityElementsHidden={!visible}
      height={visible ? 52 : 0}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      justifyContent="center"
      opacity={visible ? 1 : 0}
      overflow="hidden"
      paddingHorizontal="$l"
      pointerEvents="none"
    >
      <XStack alignItems="center" gap="$s">
        {showAvatars && (
          <XStack alignItems="center">
            <AnimatePresence>
              {visibleShips.map((shipState, index) => (
                <View
                  key={shipState.ship}
                  transition="quick"
                  scale={1}
                  opacity={1}
                  enterStyle={{ scale: 0.5, opacity: 0 }}
                  exitStyle={{ scale: 0.5, opacity: 0 }}
                  marginLeft={index === 0 ? 0 : -6}
                  zIndex={visibleShips.length - index}
                >
                  <ContactAvatar contactId={shipState.ship} size="$xl" />
                </View>
              ))}
            </AnimatePresence>
            {overflowCount > 0 && (
              <Text size="$label/s" color="$tertiaryText" marginLeft="$xs">
                +{overflowCount}
              </Text>
            )}
          </XStack>
        )}
        <Spinner size="small" color="$tertiaryText" />
        <Text size="$label/m" color="$tertiaryText" flexShrink={1}>
          {forcedLabel ?? computingState?.label ?? 'Thinking...'}
        </Text>
      </XStack>
    </View>
  );
}
