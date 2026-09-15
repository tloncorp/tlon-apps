import { isMoonOfUser } from '@tloncorp/api';
import { isDmChannelId } from '@tloncorp/api/client';

export function canUseBrowserHandoff({
  authorId,
  channelId,
  currentUserId,
  isBot,
  hasBotPosts,
  canUseAgentProviderControls,
}: {
  authorId: string;
  channelId: string;
  currentUserId: string;
  isBot?: boolean | null;
  hasBotPosts?: boolean;
  canUseAgentProviderControls: boolean;
}): boolean {
  return (
    canUseAgentProviderControls ||
    (isDmChannelId(channelId) &&
      authorId === channelId &&
      (isMoonOfUser(authorId, currentUserId) ||
        isBot === true ||
        hasBotPosts === true))
  );
}
