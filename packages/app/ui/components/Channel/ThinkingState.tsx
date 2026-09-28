import type * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, Spinner, View, XStack } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import { useConversationComputingState } from './useConversationComputingState';

const MAX_VISIBLE_AVATARS = 3;
const CYCLE_HANDOFF_MS = 1_000;

// A list remount mid-cycle (a new unread anchor on the reply) replaces this
// footer. Its replacement mounts with the reply already latest, so it needs
// the post that preceded thinking to count the reply as the response.
const cycleHandoffs = new Map<
  string,
  { baseline: string | undefined; release: ReturnType<typeof setTimeout> }
>();

export function ThinkingState({
  conversationId,
  channelType,
  latestPostId,
  latestPostAuthorId,
  forcedLabel,
  handoffKey,
}: {
  conversationId: string;
  channelType: db.Channel['type'];
  latestPostId?: string;
  latestPostAuthorId?: string;
  forcedLabel?: string;
  /** Identifies footers that replace each other when their list remounts. */
  handoffKey?: string;
}) {
  const computingState = useConversationComputingState(conversationId);
  const [holdUntilResponse, setHoldUntilResponse] = useState(false);
  const [responseObserved, setResponseObserved] = useState(false);
  const postIdWhenThinkingStarted = useRef<string | undefined>(latestPostId);
  const latestPostIdWhileIdle = useRef<string | undefined>(latestPostId);
  const expectedResponders = useRef<Set<string>>(new Set());
  const wasComputing = useRef(false);
  const collapseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Declared before the computing effect so a mount reads the handoff first.
  // An effect rather than render: in a same-commit remount the replacement
  // renders before the old footer's cleanup parks the handoff.
  useEffect(() => {
    if (!handoffKey) {
      return;
    }
    const handoff = cycleHandoffs.get(handoffKey);
    if (handoff) {
      clearTimeout(handoff.release);
      cycleHandoffs.delete(handoffKey);
      postIdWhenThinkingStarted.current = handoff.baseline;
      latestPostIdWhileIdle.current = handoff.baseline;
    }
    return () => {
      if (!wasComputing.current) {
        return;
      }
      clearTimeout(cycleHandoffs.get(handoffKey)?.release);
      cycleHandoffs.set(handoffKey, {
        baseline: postIdWhenThinkingStarted.current,
        release: setTimeout(
          () => cycleHandoffs.delete(handoffKey),
          CYCLE_HANDOFF_MS
        ),
      });
    };
  }, [handoffKey]);

  useEffect(() => {
    if (computingState) {
      expectedResponders.current = new Set(
        computingState.ships.map((state) => state.ship)
      );
      if (!wasComputing.current) {
        postIdWhenThinkingStarted.current = latestPostIdWhileIdle.current;
        setResponseObserved(
          latestPostId !== latestPostIdWhileIdle.current &&
            (expectedResponders.current.size === 0 ||
              (latestPostAuthorId != null &&
                expectedResponders.current.has(latestPostAuthorId)))
        );
        setHoldUntilResponse(true);
      } else if (
        latestPostId !== postIdWhenThinkingStarted.current &&
        (expectedResponders.current.size === 0 ||
          (latestPostAuthorId != null &&
            expectedResponders.current.has(latestPostAuthorId)))
      ) {
        setResponseObserved(true);
      }
      wasComputing.current = true;
      if (collapseTimeout.current) {
        clearTimeout(collapseTimeout.current);
        collapseTimeout.current = null;
      }
      return;
    }
    wasComputing.current = false;

    const responseHasArrived =
      holdUntilResponse &&
      (responseObserved ||
        (latestPostId !== postIdWhenThinkingStarted.current &&
          (expectedResponders.current.size === 0 ||
            (latestPostAuthorId != null &&
              expectedResponders.current.has(latestPostAuthorId)))));
    latestPostIdWhileIdle.current = latestPostId;
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
  }, [
    computingState,
    holdUntilResponse,
    latestPostAuthorId,
    latestPostId,
    responseObserved,
  ]);

  useEffect(() => {
    return () => {
      if (collapseTimeout.current) clearTimeout(collapseTimeout.current);
    };
  }, []);

  const responseHasArrived =
    holdUntilResponse &&
    (responseObserved ||
      (latestPostId !== postIdWhenThinkingStarted.current &&
        (expectedResponders.current.size === 0 ||
          (latestPostAuthorId != null &&
            expectedResponders.current.has(latestPostAuthorId)))));
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
      {visible ? (
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
      ) : null}
    </View>
  );
}
