import Clipboard from '@react-native-clipboard/clipboard';
import { type Session, useCurrentSession } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import { useIsAdmin } from '../../../utils';
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
  channelType,
  post,
  onEdit,
  onViewReactions,
}: {
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  post: db.Post;
  channelType: db.ChannelType;
}) {
  const currentSession = useCurrentSession();
  const currentUserId = useCurrentUserId();
  const { addAttachment } = useAttachmentContext();
  const channel = useChannelContext();
  const currenUserIsAdmin = useIsAdmin(post.groupId ?? '', currentUserId);
  const postActions = useMemo(() => {
    return getPostActions({
      post,
      channelType,
      isMuted: logic.isMuted(post.volumeSettings?.level, 'thread'),
    }).filter((action) => {
      switch (action.id) {
        case 'startThread':
          // only show start thread if
          // 1. the message is delivered
          // 2. the message isn't a reply
          // 3. an existing thread for that message doesn't already exist
          return (
            !post.deliveryStatus && !post.parentId && post.replyCount === 0
          );
        case 'edit':
          // only show edit for current user's posts
          return post.authorId === currentUserId;
        case 'delete':
          // only show delete for current user's posts
          return post.authorId === currentUserId || currenUserIsAdmin;
        case 'viewReactions':
          return (post.reactions?.length ?? 0) > 0;
        default:
          return true;
      }
    });
  }, [post, channelType, currentUserId, currenUserIsAdmin]);

  return (
    // arbitrary width that looks reasonable given labels
    <ActionList width={220}>
      {postActions.map((action, index) => (
        <ActionList.Action
          disabled={
            action.networkDependent &&
            (!currentSession || currentSession?.isReconnecting)
          }
          onPress={() =>
            handleAction({
              id: action.id,
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
              isNetworkDependent: action.networkDependent,
            })
          }
          key={action.id}
          actionType={action.actionType}
          last={index === postActions.length - 1 && !__DEV__}
        >
          {action.label}
        </ActionList.Action>
      ))}
      {ENABLE_COPY_JSON ? <CopyJsonAction post={post} /> : null}
    </ActionList>
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

interface ChannelAction {
  id: string;
  label: string;
  actionType?: 'destructive';
  networkDependent: boolean;
}
export function getPostActions({
  post,
  channelType,
  isMuted,
}: {
  post: db.Post;
  channelType: db.ChannelType;
  isMuted?: boolean;
}): ChannelAction[] {
  switch (channelType) {
    case 'gallery':
      return [
        { id: 'startThread', label: 'Comment on post', networkDependent: true },
        {
          id: 'muteThread',
          label: isMuted ? 'Unmute thread' : 'Mute thread',
          networkDependent: true,
        },
        { id: 'copyRef', label: 'Copy link to post', networkDependent: false },
        { id: 'edit', label: 'Edit post', networkDependent: true },
        { id: 'report', label: 'Report post', networkDependent: true },
        {
          id: 'visibility',
          label: post?.hidden ? 'Show post' : 'Hide post',
          networkDependent: true,
        },
        {
          id: 'delete',
          label: 'Delete message',
          actionType: 'destructive',
          networkDependent: true,
        },
      ];
    case 'notebook':
      return [
        { id: 'startThread', label: 'Comment on post', networkDependent: true },
        {
          id: 'muteThread',
          label: isMuted ? 'Unmute thread' : 'Mute thread',
          networkDependent: true,
        },
        { id: 'copyRef', label: 'Copy link to post', networkDependent: false },
        { id: 'edit', label: 'Edit post', networkDependent: true },
        { id: 'report', label: 'Report post', networkDependent: true },
        {
          id: 'visibility',
          label: post?.hidden ? 'Show post' : 'Hide post',
          networkDependent: true,
        },
        {
          id: 'delete',
          label: 'Delete message',
          actionType: 'destructive',
          networkDependent: true,
        },
      ];
    case 'dm':
    case 'groupDm':
      return [
        // { id: 'quote', label: 'Quote' },
        { id: 'startThread', label: 'Start thread', networkDependent: true },
        {
          id: 'muteThread',
          label: isMuted ? 'Unmute thread' : 'Mute thread',
          networkDependent: true,
        },
        {
          id: 'viewReactions',
          label: 'View reactions',
          networkDependent: false,
        },
        { id: 'copyText', label: 'Copy message text', networkDependent: false },
        {
          id: 'visibility',
          label: post?.hidden ? 'Show post' : 'Hide post',
          networkDependent: true,
        },
        {
          id: 'delete',
          label: 'Delete message',
          actionType: 'destructive',
          networkDependent: true,
        },
      ];
    case 'chat':
    default:
      return [
        { id: 'quote', label: 'Quote', networkDependent: true },
        { id: 'startThread', label: 'Start thread', networkDependent: true },
        {
          id: 'muteThread',
          label: isMuted ? 'Unmute thread' : 'Mute thread',
          networkDependent: true,
        },
        {
          id: 'viewReactions',
          label: 'View reactions',
          networkDependent: false,
        },
        {
          id: 'copyRef',
          label: 'Copy link to message',
          networkDependent: false,
        },
        { id: 'copyText', label: 'Copy message text', networkDependent: false },
        { id: 'edit', label: 'Edit message', networkDependent: true },
        {
          id: 'visibility',
          label: post?.hidden ? 'Show post' : 'Hide post',
          networkDependent: true,
        },
        { id: 'report', label: 'Report message', networkDependent: true },
        {
          id: 'delete',
          label: 'Delete message',
          actionType: 'destructive',
          networkDependent: true,
        },
      ];
  }
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
  id: string;
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
