import * as db from '@tloncorp/shared/db';

import { ThinkingState } from '../Channel/ThinkingState';
import { AgentTaskRows } from './AgentTaskRows';
import { useAgentTaskRows } from './useAgentTaskRows';

/**
 * Agent activity at the foot of a conversation.
 *
 * Shows step rows when there is a lens run to build them from, and otherwise
 * falls back to the presence indicator. That fallback is not a placeholder:
 * the lens only reaches the bot's owner, so for other members of a shared
 * channel the presence indicator — with its avatars and multi-ship
 * aggregation — remains the better and only available view.
 */
export function AgentActivity({
  conversationId,
  channelType,
}: {
  conversationId: string;
  channelType: db.Channel['type'];
}) {
  const { rows, onRetry } = useAgentTaskRows(conversationId);

  if (rows.length === 0) {
    return (
      <ThinkingState
        conversationId={conversationId}
        channelType={channelType}
      />
    );
  }

  return (
    <AgentTaskRows
      rows={rows}
      variant="list"
      onRetry={onRetry ? () => onRetry() : undefined}
    />
  );
}
