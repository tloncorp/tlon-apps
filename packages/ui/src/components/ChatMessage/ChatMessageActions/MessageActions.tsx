import Clipboard from '@react-native-clipboard/clipboard';
import { ContentReference } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';

import { useChannelContext } from '../../../contexts';
import { useReferences } from '../../../contexts/references';
import ActionList from '../../ActionList';

export default function MessageActions({
  dismiss,
  onReply,
  channelType,
  post,
  currentUserId,
  onEdit,
}: {
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  post: db.Post;
  currentUserId: string;
  channelType: db.ChannelType;
}) {
  const { setReferences } = useReferences();
  const channel = useChannelContext();
  const postActions = useMemo(() => {
    return getPostActions({
      post,
      channelType,
      isMuted: post.isMuted ?? false,
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
        default:
          return true;
      }
    });
  }, [post, channelType, currentUserId]);

  return (
    // arbitrary width that looks reasonable given labels
    <ActionList width={220}>
      {postActions.map((action, index) => (
        <ActionList.Action
          onPress={() =>
            handleAction({
              id: action.id,
              post,
              channel,
              isMuted: post.isMuted ?? false,
              dismiss,
              onReply,
              onEdit,
              setReferences,
            })
          }
          key={action.id}
          actionType={action.actionType}
          last={index === postActions.length - 1}
        >
          {action.label}
        </ActionList.Action>
      ))}
    </ActionList>
  );
}

interface ChannelAction {
  id: string;
  label: string;
  actionType?: 'destructive';
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
        { id: 'startThread', label: 'Comment on post' },
        { id: 'muteThread', label: isMuted ? 'Unmute thread' : 'Mute thread' },
        { id: 'copyRef', label: 'Copy link to post' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
    case 'notebook':
      return [
        { id: 'startThread', label: 'Comment on post' },
        { id: 'muteThread', label: isMuted ? 'Unmute thread' : 'Mute thread' },
        { id: 'pin', label: 'Pin post' },
        { id: 'copyRef', label: 'Copy link to post' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
    case 'dm':
    case 'groupDm':
      return [
        // { id: 'quote', label: 'Quote' },
        { id: 'startThread', label: 'Start thread' },
        { id: 'muteThread', label: isMuted ? 'Unmute thread' : 'Mute thread' },
        { id: 'copyText', label: 'Copy message text' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
    case 'chat':
    default:
      return [
        { id: 'quote', label: 'Quote' },
        { id: 'startThread', label: 'Start thread' },
        { id: 'muteThread', label: isMuted ? 'Unmute thread' : 'Mute thread' },
        { id: 'copyRef', label: 'Copy link to message' },
        { id: 'copyText', label: 'Copy message text' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: post?.hidden ? 'Show post' : 'Hide post' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
  }
}

async function handleAction({
  id,
  post,
  channel,
  isMuted,
  dismiss,
  onReply,
  onEdit,
  setReferences,
}: {
  id: string;
  post: db.Post;
  channel: db.Channel;
  isMuted?: boolean;
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  setReferences: (references: Record<string, ContentReference | null>) => void;
}) {
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
    case 'quote':
      setReferences({ [path]: reference });
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
    case 'visibility':
      post.hidden ? store.showPost({ post }) : store.hidePost({ post });
      break;
  }

  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  dismiss();
}
