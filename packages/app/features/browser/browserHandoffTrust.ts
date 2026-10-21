import { isMoonOfUser } from '@tloncorp/api';
import { isDmChannelId } from '@tloncorp/api/client';

export function canUseBrowserHandoff({
  authorId,
  channelId,
  currentUserId,
  canUseAgentProviderControls,
  agentShipOverride,
}: {
  authorId: string;
  channelId: string;
  currentUserId: string;
  canUseAgentProviderControls: boolean;
  // Explicit application configuration, never sender-provided profile metadata.
  agentShipOverride?: string;
}): boolean {
  return (
    isDmChannelId(channelId) &&
    authorId === channelId &&
    (canUseAgentProviderControls ||
      isMoonOfUser(authorId, currentUserId) ||
      (Boolean(agentShipOverride) && authorId === agentShipOverride))
  );
}
