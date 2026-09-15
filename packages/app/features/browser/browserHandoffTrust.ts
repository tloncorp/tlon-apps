import { isMoonOfUser } from '@tloncorp/api';
import { isDmChannelId } from '@tloncorp/api/client';

export function canUseBrowserHandoff({
  authorId,
  channelId,
  currentUserId,
  canUseAgentProviderControls,
}: {
  authorId: string;
  channelId: string;
  currentUserId: string;
  canUseAgentProviderControls: boolean;
}): boolean {
  return (
    canUseAgentProviderControls ||
    (isDmChannelId(channelId) &&
      authorId === channelId &&
      isMoonOfUser(authorId, currentUserId))
  );
}
