import Clipboard from '@react-native-clipboard/clipboard';
import * as api from '@tloncorp/api';
import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Attachment } from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCopy, useToast } from '@tloncorp/ui';
import { memo, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { isWeb } from 'tamagui';

import { useRenderCount } from '../../../../hooks/useRenderCount';
import { useCurrentUserId } from '../../../contexts/appDataContext';
import { useAttachmentContext } from '../../../contexts/attachment';
import { useChannelContext } from '../../../contexts/channel';
import { triggerHaptic, useIsAdmin } from '../../../utils';
import ActionList from '../../ActionList';
import { useForwardPostSheet } from '../../ForwardPostSheet';
import {
  DraftInputContext,
  useDraftInputContext,
} from '../../draftInputs/shared';

const ENABLE_COPY_JSON = __DEV__;

export default function MessageActions({
  dismiss,
  onReply,
  post,
  postActionIds,
  onEdit,
  onViewReactions,
}: {
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  post: db.Post;
  postActionIds: ChannelAction.Id[];
}) {
  // arbitrary width that looks reasonable given labels
  const width = isWeb ? 'auto' : 220;
  return (
    <ActionList width={width}>
      {postActionIds.map((actionId, index, list) => (
        <ConnectedAction
          key={actionId}
          last={index === list.length - 1 && !__DEV__}
          {...{
            dismiss,
            onReply,
            onEdit,
            onViewReactions,
            post,
            actionId,
          }}
        />
      ))}
      {ENABLE_COPY_JSON ? <CopyJsonAction post={post} /> : null}
    </ActionList>
  );
}

const ConnectedAction = memo(function ConnectedAction({
  actionId,
  dismiss,
  last,
  onEdit,
  onReply,
  onViewReactions,
  post,
}: {
  actionId: ChannelAction.Id;
  post: db.Post;
  last: boolean;
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
}) {
  const currentUserId = useCurrentUserId();
  const connectionStatus = store.useConnectionStatus();
  const channel = useChannelContext();
  const { addAttachment } = useAttachmentContext();
  const draftInputContext = useDraftInputContext();
  const currentUserIsAdmin = useIsAdmin(post.groupId ?? '', currentUserId);
  const { open: forwardPost } = useForwardPostSheet();
  const showToast = useToast();
  const pinnedPostId = logic.getPinnedPostId(channel);

  const { label, postTerm } = useDisplaySpecForChannelActionId(actionId, {
    post,
    channel,
    currentUserId,
    currentUserIsAdmin,
  });
  const action = useMemo(
    () => ChannelAction.staticSpecForId(actionId),
    [actionId]
  );

  const visible = useMemo(() => {
    if (action.isNetworkDependent && connectionStatus !== 'Connected') {
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
        return post.parentId || (post.replyCount || 0) > 0;
      case 'edit':
        // only show edit for current user's posts
        // OR admins for top-level notebook posts
        return (
          post.authorId === currentUserId ||
          (channel.type === 'notebook' && currentUserIsAdmin && !post.parentId)
        );
      case 'delete':
        // only show delete for current user's posts
        return post.authorId === currentUserId || currentUserIsAdmin;
      case 'viewReactions':
        return (post.reactions?.length ?? 0) > 0;
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
        // DM quotes write into the composer. Search/detail surfaces can render
        // actions without a draft input context, so hide Quote there.
        if (channel.type === 'dm' || channel.type === 'groupDm') {
          return !!draftInputContext;
        }
        return true;
      default:
        return true;
    }
  }, [
    action.isNetworkDependent,
    connectionStatus,
    actionId,
    post.deliveryStatus,
    post.parentId,
    post.replyCount,
    post.authorId,
    post.id,
    post.reactions?.length,
    currentUserId,
    channel.type,
    pinnedPostId,
    currentUserIsAdmin,
    draftInputContext,
  ]);

  useRenderCount(`MessageAction-${actionId}`);

  if (!visible) {
    return null;
  }

  return (
    <ActionList.Action
      height="auto"
      onPress={() => {
        const actionArgs = {
          id: actionId,
          post,
          userId: currentUserId,
          channel,
          isMuted: logic.isMuted(post.volumeSettings?.level, 'thread'),
          dismiss,
          onReply,
          onEdit,
          onForward: forwardPost,
          onViewReactions,
          addAttachment,
          draftInputContext,
          showToast,
        };
        if (actionId === 'delete') {
          confirmDeleteAction(postTerm, () => {
            void handleAction(actionArgs);
          });
          return;
        }
        void handleAction(actionArgs);
      }}
      key={actionId}
      actionType={action.actionType}
      last={last}
    >
      {label}
    </ActionList.Action>
  );
});

function CopyJsonAction({ post }: { post: db.Post }) {
  const jsonString = useMemo(() => {
    return JSON.stringify(post.content, null, 2);
  }, [post.content]);
  const { doCopy, didCopy } = useCopy(jsonString);
  return (
    <ActionList.Action height="auto" onPress={doCopy} last>
      {!didCopy ? 'Copy post JSON' : 'Copied'}
    </ActionList.Action>
  );
}

function confirmDeleteAction(postTerm: string, onConfirm: () => void) {
  const title = `Delete ${postTerm}?`;
  const message = 'This action cannot be undone.';

  if (isWeb) {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: `Delete ${postTerm}`,
      style: 'destructive',
      onPress: () => {
        onConfirm();
      },
    },
  ]);
}

export async function handleAction({
  id,
  post,
  userId,
  channel,
  isMuted,
  dismiss,
  onReply,
  onEdit,
  onViewReactions,
  onForward,
  addAttachment,
  draftInputContext,
  showToast,
}: {
  id: ChannelAction.Id;
  post: db.Post;
  userId: string;
  channel: db.Channel;
  isMuted?: boolean;
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onForward?: (post: db.Post) => void;
  onViewReactions?: (post: db.Post) => void;
  addAttachment: (attachment: Attachment) => void;
  draftInputContext?: DraftInputContext | null;
  showToast?: (options: { message: string; duration?: number }) => void;
}) {
  const [path, reference] = logic.postToContentReference(post);

  switch (id) {
    case 'debugJson':
      db.debugMessageJson.setValue(!(await db.debugMessageJson.getValue()));
      break;
    case 'startThread':
      // give the actions time to fade out before navigating
      setTimeout(() => onReply?.(post), 50);
      break;
    case 'muteThread':
      isMuted
        ? store.unmuteThread({ channel, thread: post })
        : store.muteThread({ channel, thread: post });
      break;
    case 'viewReactions':
      onViewReactions?.(post);
      break;
    case 'quote':
      if (
        (channel.type === 'dm' || channel.type === 'groupDm') &&
        post.textContent
      ) {
        await prependTextToDraft(draftInputContext, `> ${post.textContent}\n`);
      } else {
        // For other channel types, use reference attachment
        addAttachment({ type: 'reference', reference, path });
      }
      break;
    case 'edit':
      onEdit?.();
      break;
    case 'copyRef':
      Clipboard.setString(logic.getPostReferencePath(post));
      break;
    case 'copyText':
      Clipboard.setString(post.textContent ?? '');
      break;
    case 'delete':
      store.deletePost({ post });
      break;
    case 'report':
      store.reportPost({ userId, post });
      break;
    case 'visibility':
      post.hidden ? store.showPost({ post }) : store.hidePost({ post });
      break;
    case 'forward':
      // On iOS, dismiss the current modal first, then open the forward sheet
      // to avoid race condition between two modals
      if (Platform.OS === 'ios') {
        dismiss();
        setTimeout(() => onForward?.(post), 300);
      } else {
        onForward?.(post);
        dismiss();
      }
      triggerHaptic('success');
      return; // Early return to avoid double dismiss
    case 'pinPost':
      store.pinPostToChannel({ channel, postId: post.id });
      break;
    case 'unpinPost':
      store.unpinPostFromChannel({ channel });
      break;
  }

  triggerHaptic('success');
  dismiss();
}

async function prependTextToDraft(
  ctx: DraftInputContext | null | undefined,
  text: string
) {
  // DM quote actions should be rendered under the current draft input context.
  // Missing context means the provider wiring is wrong, not that we should fall back to refs.
  if (!ctx) {
    throw new Error('Cannot quote DM text without a draft input context');
  }

  const draft = await ctx.getDraft();
  const { text: existing, mentions } = draft
    ? logic.contentToTextAndMentions(draft)
    : { text: '', mentions: [] };
  await ctx.storeDraft(
    logic.textAndMentionsToContent(
      text + existing,
      mentions.map((m) => ({
        ...m,
        start: m.start + text.length,
        end: m.end + text.length,
      }))
    )
  );
  ctx.draftInputRef?.current?.startDraft?.();
}

/**
 * Extra information about how to display the action. This can change based on
 * the UI context - e.g. the label for `startThread` changes based on channel
 * type.
 */
export function useDisplaySpecForChannelActionId(
  id: ChannelAction.Id,
  {
    post,
    channel,
    currentUserId,
    currentUserIsAdmin,
  }: {
    post: db.Post;
    channel: db.Channel;
    currentUserId: string;
    currentUserIsAdmin: boolean;
  }
): {
  label: string;
  postTerm: string;
} {
  const isMuted = logic.isMuted(post.volumeSettings?.level, 'thread');
  const postTerm = useMemo(() => {
    return ['dm', 'groupDm', 'chat'].includes(channel?.type)
      ? 'message'
      : 'post';
  }, [channel?.type]);

  const spec = useMemo(() => {
    switch (id) {
      case 'debugJson':
        return { label: 'Toggle debug' };
      case 'copyRef':
        return {
          label:
            postTerm === 'message'
              ? 'Copy link to message'
              : 'Copy link to post',
        };

      case 'copyText':
        return { label: 'Copy message text' };

      case 'delete':
        if (post.authorId !== currentUserId && currentUserIsAdmin) {
          return {
            label:
              'Admin: ' +
              (postTerm === 'message' ? 'Delete message' : 'Delete post'),
          };
        }
        return {
          label: postTerm === 'message' ? 'Delete message' : 'Delete post',
        };

      case 'edit':
        if (post.authorId !== currentUserId && currentUserIsAdmin) {
          return {
            label:
              'Admin: ' +
              (postTerm === 'message' ? 'Edit message' : 'Edit post'),
          };
        }
        return {
          label: postTerm === 'message' ? 'Edit message' : 'Edit post',
        };

      case 'muteThread':
        return { label: isMuted ? 'Unmute thread' : 'Mute thread' };

      case 'quote':
        return { label: 'Quote' };

      case 'report':
        return {
          label: postTerm === 'message' ? 'Report message' : 'Report post',
        };

      case 'startThread':
        return {
          label: ['dm', 'groupDm', 'chat'].includes(channel?.type)
            ? 'Reply'
            : 'Comment',
        };

      case 'forward':
        return { label: 'Forward' };

      case 'viewReactions':
        return { label: 'View reactions' };

      case 'visibility': {
        const showMsg = postTerm === 'message' ? 'Show message' : 'Show post';
        const hideMsg = postTerm === 'message' ? 'Hide message' : 'Hide post';
        return { label: post.hidden ? showMsg : hideMsg };
      }

      case 'pinPost':
        return { label: 'Pin post to channel' };

      case 'unpinPost':
        return { label: 'Unpin post' };
    }
  }, [
    id,
    postTerm,
    post.authorId,
    post.hidden,
    currentUserId,
    currentUserIsAdmin,
    isMuted,
    channel?.type,
  ]);

  return { ...spec, postTerm };
}
