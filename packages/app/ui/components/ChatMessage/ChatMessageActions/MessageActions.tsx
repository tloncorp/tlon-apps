import Clipboard from '@react-native-clipboard/clipboard';
import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCopy } from '@tloncorp/ui';
import { memo, useMemo } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { useRenderCount } from '../../../../hooks/useRenderCount';
import { useChannelContext, useCurrentUserId } from '../../../contexts';
import { Attachment, useAttachmentContext } from '../../../contexts/attachment';
import { triggerHaptic, useIsAdmin } from '../../../utils';
import ActionList from '../../ActionList';
import { useForwardPostSheet } from '../../ForwardPostSheet';

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
          {...{ dismiss, onReply, onEdit, onViewReactions, post, actionId }}
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
  const currentUserIsAdmin = useIsAdmin(post.groupId ?? '', currentUserId);
  const { open: forwardPost } = useForwardPostSheet();

  const { label } = useDisplaySpecForChannelActionId(actionId, {
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
    switch (actionId) {
      case 'startThread':
        // only show start thread if
        // 1. the message is delivered
        // 2. the message isn't a reply
        // 3. an existing thread for that message doesn't already exist
        return !post.deliveryStatus && !post.parentId && post.replyCount === 0;
      case 'muteThread':
        // only show mute for threads
        return post.parentId;
      case 'edit':
        // only show edit for current user's posts OR admins of notebook posts
        return (
          post.authorId === currentUserId ||
          (channel.type === 'notebook' && currentUserIsAdmin)
        );
      case 'delete':
        // only show delete for current user's posts
        return post.authorId === currentUserId || currentUserIsAdmin;
      case 'viewReactions':
        return (post.reactions?.length ?? 0) > 0;
      case 'visibility':
        // prevent users from hiding their own posts
        return post.authorId !== currentUserId;
      default:
        return true;
    }
  }, [
    actionId,
    post.deliveryStatus,
    post.parentId,
    post.replyCount,
    post.authorId,
    post.reactions?.length,
    currentUserId,
    channel.type,
    currentUserIsAdmin,
  ]);

  useRenderCount(`MessageAction-${actionId}`);

  if (!visible) {
    return null;
  }

  return (
    <ActionList.Action
      disabled={action.isNetworkDependent && connectionStatus !== 'Connected'}
      height="auto"
      onPress={() =>
        handleAction({
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
          isConnected: connectionStatus === 'Connected',
          isNetworkDependent: action.isNetworkDependent,
        })
      }
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
  isConnected,
  isNetworkDependent,
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
  isConnected: boolean;
  isNetworkDependent: boolean;
}) {
  if (isNetworkDependent && !isConnected) {
    Alert.alert(
      'App is disconnected',
      'This action is unavailable while the app is in a disconnected state.'
    );
    return;
  }

  const [path, reference] = logic.postToContentReference(post);

  switch (id) {
    case 'debugJson':
      db.debugMessageJson.setValue(!(await db.debugMessageJson.getValue()));
      console.log(`toggling debug`, await db.debugMessageJson.getValue());
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
        // For DMs, insert text as markdown quote
        addAttachment({ type: 'text', text: `> ${post.textContent}\n` });
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
      onForward?.(post);
      break;
  }

  triggerHaptic('success');
  dismiss();
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
} {
  const isMuted = logic.isMuted(post.volumeSettings?.level, 'thread');
  const postTerm = useMemo(() => {
    return ['dm', 'groupDm', 'chat'].includes(channel?.type)
      ? 'message'
      : 'post';
  }, [channel?.type]);

  return useMemo(() => {
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
}
