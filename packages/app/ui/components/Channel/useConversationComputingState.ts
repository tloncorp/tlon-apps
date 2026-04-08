import {
  getComputingStatusText,
  parseComputingStatus,
  type ComputingToolCall,
} from '@tloncorp/api';
import { useConversationPresence } from '@tloncorp/shared';
import { da, parse } from '@urbit/aura';
import { useMemo } from 'react';

type ConversationComputingState = {
  label: string;
  toolCalls: ComputingToolCall[];
};

function parsePresenceTimestamp(since: string) {
  try {
    return Number(da.toUnix(parse('da', since)));
  } catch {
    return null;
  }
}

export function useConversationComputingState(
  conversationId: string
) {
  const presenceStates = useConversationPresence(conversationId);

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
