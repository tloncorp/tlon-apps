import {
  type ComputingToolCall,
  getComputingStatusText,
  parseComputingStatus,
} from '@tloncorp/api';
import { useConversationPresence } from '@tloncorp/shared';
import { useMemo } from 'react';

import { useCalm, useContactIndex } from '../../contexts/appDataContext';
import { resolveContactNameProps } from '../contactNameResolver';

export type ShipComputingState = {
  ship: string;
  label: string;
  toolCalls: ComputingToolCall[];
};

export type ConversationComputingState = {
  ships: ShipComputingState[];
  label: string;
  toolCalls: ComputingToolCall[];
};

export function useConversationComputingState(conversationId: string) {
  const presenceStates = useConversationPresence(conversationId);
  const contactIndex = useContactIndex();
  const calm = useCalm();

  return useMemo<ConversationComputingState | null>(() => {
    const ships: ShipComputingState[] = [];

    for (const status of presenceStates) {
      if (status.key.topic !== 'computing') {
        continue;
      }

      const parsedStatus = parseComputingStatus(status.display.blob);
      if (parsedStatus && !parsedStatus.thinking) {
        continue;
      }

      const label =
        status.display.text?.trim() ||
        (parsedStatus ? getComputingStatusText(parsedStatus) : null) ||
        'Thinking...';

      const toolCalls =
        parsedStatus?.toolCalls.filter((toolCall) => {
          return parsedStatus.toolCalls.length > 1 || toolCall.label !== label;
        }) ?? [];

      ships.push({ ship: status.key.ship, label, toolCalls });
    }

    if (ships.length === 0) {
      return null;
    }

    // Sort by ship (not timing.since) so heartbeat re-publishes don't reorder.
    ships.sort((left, right) => left.ship.localeCompare(right.ship));

    if (ships.length === 1) {
      return {
        ships,
        label: ships[0].label,
        toolCalls: ships[0].toolCalls,
      };
    }

    if (ships.length === 2) {
      const [first, second] = ships.map((shipState) => {
        const resolved = resolveContactNameProps({
          contact: contactIndex?.[shipState.ship] ?? null,
          contactId: shipState.ship,
          calmDisableNicknames: calm.disableNicknames,
        });
        return resolved.children || shipState.ship;
      });
      return {
        ships,
        label: `${first} and ${second} are thinking...`,
        toolCalls: [],
      };
    }

    return {
      ships,
      label: `${ships.length} bots are thinking...`,
      toolCalls: [],
    };
  }, [presenceStates, contactIndex, calm.disableNicknames]);
}
