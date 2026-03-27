import {
  getComputingStatusText,
  parseComputingStatus,
  subscribeToConversationPresenceUpdates,
  type ComputingToolCall,
  type PresenceEvent,
  type PresenceStatus,
  unsubscribe,
} from '@tloncorp/api';
import { da, parse } from '@urbit/aura';
import { useEffect, useMemo, useState } from 'react';

type ConversationComputingState = {
  label: string;
  toolCalls: ComputingToolCall[];
};

function getPresenceStatusId(status: Pick<PresenceStatus, 'key'>) {
  return `${status.key.context}:${status.key.topic}:${status.key.ship}`;
}

function parsePresenceTimestamp(since: string) {
  try {
    return Number(da.toUnix(parse('da', since)));
  } catch {
    return null;
  }
}

function applyPresenceEvent(current: PresenceStatus[], event: PresenceEvent) {
  if (event.type === 'init') {
    return event.states;
  }

  if (event.type === 'set') {
    const next = current.filter(
      (status) => getPresenceStatusId(status) !== getPresenceStatusId(event.state)
    );
    next.push(event.state);
    return next;
  }

  return current.filter(
    (status) => getPresenceStatusId(status) !== getPresenceStatusId({ key: event.key })
  );
}

export function useConversationComputingState(
  conversationId: string
) {
  const [presenceStates, setPresenceStates] = useState<PresenceStatus[]>([]);

  useEffect(() => {
    let cancelled = false;
    let subscriptionId: number | null = null;

    setPresenceStates([]);

    subscribeToConversationPresenceUpdates(conversationId, (event) => {
      if (cancelled) {
        return;
      }

      setPresenceStates((current) => applyPresenceEvent(current, event));
    })
      .then((id) => {
        if (cancelled) {
          void unsubscribe(id);
          return;
        }

        subscriptionId = id;
      })
      .catch(() => {});

    return () => {
      cancelled = true;

      if (subscriptionId != null) {
        void unsubscribe(subscriptionId);
      }
    };
  }, [conversationId]);

  return useMemo<ConversationComputingState | null>(() => {
    const activeStates = presenceStates
      .filter((status) => status.key.topic === 'computing')
      .sort((left, right) => {
        const leftSince = parsePresenceTimestamp(left.timing.since) ?? 0;
        const rightSince = parsePresenceTimestamp(right.timing.since) ?? 0;
        return rightSince - leftSince;
      });

    const activeState = activeStates[0];
    if (!activeState) {
      return null;
    }

    const parsedStatus = parseComputingStatus(activeState.display.blob);
    if (parsedStatus && !parsedStatus.thinking) {
      return null;
    }

    const label =
      activeState.display.text?.trim() ||
      (parsedStatus ? getComputingStatusText(parsedStatus) : null) ||
      'Thinking...';

    if (!label) {
      return null;
    }

    const toolCalls =
      parsedStatus?.toolCalls.filter((toolCall) => {
        return parsedStatus.toolCalls.length > 1 || toolCall.label !== label;
      }) ?? [];

    return {
      label,
      toolCalls,
    };
  }, [presenceStates]);
}
