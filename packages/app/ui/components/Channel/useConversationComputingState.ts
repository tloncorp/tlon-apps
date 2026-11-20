import {
  type ComputingToolCall,
  type PresenceStatus,
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
  /** Tool calls to list beside the label; one that repeats it is dropped. */
  toolCalls: ComputingToolCall[];
  /** Every tool call the bot reports, for motion that follows its work. */
  activeToolCalls: ComputingToolCall[];
};

export type ConversationComputingState = {
  ships: ShipComputingState[];
  label: string;
  toolCalls: ComputingToolCall[];
  activeToolCalls: ComputingToolCall[];
};

/** What one presence entry says a bot is doing, or null if it isn't working. */
export function readComputingStatus(
  status: PresenceStatus
): ShipComputingState | null {
  if (status.key.topic !== 'computing') {
    return null;
  }

  const parsedStatus = parseComputingStatus(status.display.blob);
  if (parsedStatus && !parsedStatus.thinking) {
    return null;
  }

  const label =
    status.display.text?.trim() ||
    (parsedStatus ? getComputingStatusText(parsedStatus) : null) ||
    'Thinking...';
  const activeToolCalls = parsedStatus?.toolCalls ?? [];
  const toolCalls = activeToolCalls.filter((toolCall) => {
    return activeToolCalls.length > 1 || toolCall.label !== label;
  });

  return { ship: status.key.ship, label, toolCalls, activeToolCalls };
}

export function useConversationComputingState(conversationId: string) {
  const presenceStates = useConversationPresence(conversationId);
  const contactIndex = useContactIndex();
  const calm = useCalm();

  return useMemo<ConversationComputingState | null>(() => {
    const ships: ShipComputingState[] = [];

    for (const status of presenceStates) {
      const shipState = readComputingStatus(status);
      if (shipState) {
        ships.push(shipState);
      }
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
        activeToolCalls: ships[0].activeToolCalls,
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
        activeToolCalls: ships.flatMap((ship) => ship.activeToolCalls),
      };
    }

    return {
      ships,
      label: `${ships.length} bots are thinking...`,
      toolCalls: [],
      activeToolCalls: ships.flatMap((ship) => ship.activeToolCalls),
    };
  }, [presenceStates, contactIndex, calm.disableNicknames]);
}
