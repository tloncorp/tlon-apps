import Clipboard from '@react-native-clipboard/clipboard';
import { type Session, useCurrentSession } from '@tloncorp/shared';
import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { useChannelContext, useCurrentUserId } from '../../../contexts';
import { Attachment, useAttachmentContext } from '../../../contexts/attachment';
import { useCopy } from '../../../hooks/useCopy';
import ActionList from '../../ActionList';

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
  return (
    // arbitrary width that looks reasonable given labels
    <ActionList width={220}>
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

function ConnectedAction({
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
  const currentSession = useCurrentSession();
  const channel = useChannelContext();
  const { addAttachment } = useAttachmentContext();

  const { label } = useDisplaySpecForChannelActionId(actionId, {
    post,
    channel,
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
      case 'edit':
        // only show edit for current user's posts
        return post.authorId === currentUserId;
      case 'viewReactions':
        return (post.reactions?.length ?? 0) > 0;
      default:
        return true;
    }
  }, [post, actionId, currentUserId]);

  if (!visible) {
    return null;
  }

  return (
    <ActionList.Action
      disabled={
        action.isNetworkDependent &&
        (!currentSession || currentSession?.isReconnecting)
      }
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
          onViewReactions,
          addAttachment,
          currentSession,
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
}

function CopyJsonAction({ post }: { post: db.Post }) {
  const jsonString = useMemo(() => {
    return JSON.stringify(post.content, null, 2);
  }, [post.content]);
  const { doCopy, didCopy } = useCopy(jsonString);
  return (
    <ActionList.Action onPress={doCopy} last>
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
  addAttachment,
  currentSession,
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
  onViewReactions?: (post: db.Post) => void;
  addAttachment: (attachment: Attachment) => void;
  currentSession: Session | null;
  isNetworkDependent: boolean;
}) {
  if (
    isNetworkDependent &&
    (!currentSession || currentSession?.isReconnecting)
  ) {
    Alert.alert(
      'App is disconnected',
      'This action is unavailable while the app is in a disconnected state.'
    );
    return;
  }

  const [path, reference] = logic.postToContentReference(post);

  switch (id) {
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
      addAttachment({ type: 'reference', reference, path });
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
  }

  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
  }: {
    post: db.Post;
    channel: db.Channel;
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
        return {
          label: postTerm === 'message' ? 'Delete message' : 'Delete post',
        };

      case 'edit':
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
            ? 'Start thread'
            : 'Comment on post',
        };

      case 'viewReactions':
        return { label: 'View reactions' };

      case 'visibility': {
        const showMsg = postTerm === 'message' ? 'Show message' : 'Show post';
        const hideMsg = postTerm === 'message' ? 'Hide message' : 'Hide post';
        return { label: post.hidden ? showMsg : hideMsg };
      }
    }
  }, [channel?.type, isMuted, post.hidden, id, postTerm]);
}
