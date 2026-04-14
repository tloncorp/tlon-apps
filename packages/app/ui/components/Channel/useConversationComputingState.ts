import {
  type ComputingToolCall,
  getComputingStatusText,
  parseComputingStatus,
} from '@tloncorp/api';
import { useConversationPresence } from '@tloncorp/shared';
import { useMemo } from 'react';

type ConversationComputingState = {
  label: string;
  toolCalls: ComputingToolCall[];
};

export function useConversationComputingState(conversationId: string) {
  const presenceStates = useConversationPresence(conversationId);

  return useMemo<ConversationComputingState | null>(() => {
    const activeStates = presenceStates
      .filter((status) => status.key.topic === 'computing')
      .sort((left, right) => right.timing.since - left.timing.since);

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
