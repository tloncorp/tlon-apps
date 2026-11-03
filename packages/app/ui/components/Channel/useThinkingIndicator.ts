import { useEffect, useRef, useState } from 'react';

import {
  type ConversationComputingState,
  useConversationComputingState,
} from './useConversationComputingState';

export type ThinkingIndicator = {
  /** Whether the conversation reads as "thinking" right now. */
  visible: boolean;
  label: string;
  computingState: ConversationComputingState | null;
};

/**
 * When a conversation shows its thinking indicator. It shows while a bot
 * reports computing, for a caller's forced label, and after computing ends
 * until the bot's reply lands (or two seconds pass), so the indicator does
 * not drop out in the gap before the reply appears.
 *
 * The thinking row and the bot bauble both read this, so they agree.
 */
export function useThinkingIndicator({
  conversationId,
  latestPostId,
  latestPostAuthorId,
  forcedLabel,
}: {
  conversationId: string;
  latestPostId?: string;
  latestPostAuthorId?: string;
  forcedLabel?: string;
}): ThinkingIndicator {
  const computingState = useConversationComputingState(conversationId);
  const [holdUntilResponse, setHoldUntilResponse] = useState(false);
  const [responseObserved, setResponseObserved] = useState(false);
  const postIdWhenThinkingStarted = useRef<string | undefined>(latestPostId);
  const latestPostIdWhileIdle = useRef<string | undefined>(latestPostId);
  const expectedResponders = useRef<Set<string>>(new Set());
  const wasComputing = useRef(false);
  const collapseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return {
    visible,
    label: forcedLabel ?? computingState?.label ?? 'Thinking...',
    computingState,
  };
}
