import type { ChannelAction } from '@tloncorp/shared';

/**
 * Everything the visibility rules depend on, flattened so the rules stay pure
 * and directly testable. Callers project their `db.Post` / `db.Channel` into
 * this rather than the rules reaching into those types.
 */
export interface MessageActionVisibilityContext {
  /** From `ChannelAction.staticSpecForId(actionId).isNetworkDependent`. */
  isNetworkDependent: boolean;
  isConnected: boolean;
  currentUserId: string;
  currentUserIsAdmin: boolean;
  /** Whether a composer is mounted to receive prefilled draft text. */
  canStartDraft: boolean;
  channelType: string;
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

/**
 * Whether an action should appear in the message menu for this post. Shared by
 * every surface that renders message actions - the web/Android action sheet and
 * the native iOS context menu both filter through this.
 */
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
      // only show start thread if
      // 1. the message is delivered
      // 2. the message isn't a reply
      return !post.deliveryStatus && !post.parentId;
    case 'muteThread':
      // show mute/unmute if the post has replies or is in a thread
      return Boolean(post.parentId || (post.replyCount || 0) > 0);
    case 'edit':
      // only show edit for current user's posts
      // OR admins for top-level notebook posts
      return (
        post.authorId === currentUserId ||
        (channelType === 'notebook' && currentUserIsAdmin && !post.parentId)
      );
    case 'delete':
      // only show delete for current user's posts
      return post.authorId === currentUserId || currentUserIsAdmin;
    case 'viewReactions':
      return post.reactionCount > 0;
    case 'visibility':
      // prevent users from hiding their own posts
      return post.authorId !== currentUserId;
    case 'pinPost':
      // only show for admins, top-level posts, and not already pinned
      return currentUserIsAdmin && !post.parentId && pinnedPostId !== post.id;
    case 'unpinPost':
      // only show for admins on the currently pinned post
      return currentUserIsAdmin && pinnedPostId === post.id;
    case 'quote':
      // Quote needs the active composer surface. Search/detail surfaces can
      // render actions without one, so hide Quote there.
      return canStartDraft;
    case 'replyToComment':
      // Only show on actual comments (replies), and only where a composer
      // is mounted to receive the prefilled mention.
      return (
        Boolean(post.parentId) &&
        post.authorId !== currentUserId &&
        canStartDraft
      );
    default:
      return true;
  }
}
