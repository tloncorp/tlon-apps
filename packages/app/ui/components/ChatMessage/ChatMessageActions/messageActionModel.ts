import type { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';

export type MessageMenuActionId = ChannelAction.Id | 'viewBotRun';

export interface MessageMenuActionDescriptor {
  id: MessageMenuActionId;
  title: string;
  systemImage?: string;
  /** Native menus render reports and deletes as destructive. */
  destructive?: boolean;
  /** The shared action sheet currently marks only deletes as destructive. */
  actionType?: 'destructive';
  /** Opaque snapshot of the action semantics shown to the user. */
  token: string;
}

export interface MessageActionVisibilityContext {
  isNetworkDependent: boolean;
  isConnected: boolean;
  currentUserId: string;
  currentUserIsAdmin: boolean;
  canStartDraft: boolean;
  channelType: db.Channel['type'];
  pinnedPostId?: string | null;
  post: {
    id: string;
    authorId: string;
    parentId?: string | null;
    deliveryStatus?: unknown;
    replyCount?: number | null;
    reactionCount: number;
  };
}

export function messageActionToken(
  post: db.Post,
  contentKey: string,
  descriptor: Omit<MessageMenuActionDescriptor, 'token'>
) {
  return JSON.stringify([
    post.id,
    contentKey,
    descriptor,
    descriptor.id === 'viewReactions' ? post.reactions : null,
  ]);
}

export function messageContentKey(post: db.Post) {
  return JSON.stringify([
    post.content,
    post.textContent,
    post.title,
    post.image,
    post.description,
    post.cover,
    post.isDeleted,
  ]);
}

export function isMessageActionVisible(
  actionId: ChannelAction.Id,
  {
    isNetworkDependent,
    isConnected,
    currentUserId,
    currentUserIsAdmin,
    canStartDraft,
    channelType,
    pinnedPostId,
    post,
  }: MessageActionVisibilityContext
): boolean {
  if (isNetworkDependent && !isConnected) {
    return false;
  }

  switch (actionId) {
    case 'startThread':
      return !post.deliveryStatus && !post.parentId;
    case 'muteThread':
      return Boolean(post.parentId || (post.replyCount || 0) > 0);
    case 'edit':
      return (
        post.authorId === currentUserId ||
        (channelType === 'notebook' && currentUserIsAdmin && !post.parentId)
      );
    case 'delete':
      return post.authorId === currentUserId || currentUserIsAdmin;
    case 'viewReactions':
      return post.reactionCount > 0;
    case 'visibility':
      return post.authorId !== currentUserId;
    case 'pinPost':
      return currentUserIsAdmin && !post.parentId && pinnedPostId !== post.id;
    case 'unpinPost':
      return currentUserIsAdmin && pinnedPostId === post.id;
    case 'quote':
      return canStartDraft;
    case 'replyToComment':
      return (
        Boolean(post.parentId) &&
        post.authorId !== currentUserId &&
        canStartDraft
      );
    default:
      return true;
  }
}
