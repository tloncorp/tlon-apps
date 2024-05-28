import Clipboard from '@react-native-clipboard/clipboard';
import { ContentReference } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';

import { useReferences } from '../../../contexts/references';
import ActionList from '../../ActionList';

export default function MessageActions({
  dismiss,
  onReply,
  channelType,
  post,
}: {
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  post: db.Post;
  channelType: db.ChannelType;
}) {
  const { setReferences } = useReferences();
  const postActions = useMemo(() => {
    return getPostActions(post, channelType).filter((action) => {
      // if undelivered or already in a thread, don't show reply
      if (
        action.id === 'startThread' &&
        (post.deliveryStatus || post.parentId)
      ) {
        return false;
      }
      return true;
    });
  }, [post, channelType]);

  return (
    // arbitrary width that looks reasonable given labels
    <ActionList width={220}>
      {postActions.map((action, index) => (
        <ActionList.Action
          onPress={() =>
            handleAction({
              id: action.id,
              post,
              dismiss,
              onReply,
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
function getPostActions(
  post: db.Post,
  channelType: db.ChannelType
): ChannelAction[] {
  switch (channelType) {
    case 'gallery':
      return [
        { id: 'startThread', label: 'Comment on post' },
        { id: 'copyRef', label: 'Copy link to post' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
    case 'notebook':
      return [
        { id: 'startThread', label: 'Comment on post' },
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
        { id: 'copyText', label: 'Copy message text' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
    case 'chat':
    default:
      return [
        { id: 'quote', label: 'Quote' },
        { id: 'startThread', label: 'Start thread' },
        { id: 'copyRef', label: 'Copy link to message' },
        { id: 'copyText', label: 'Copy message text' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: post.hidden ? 'Show post' : 'Hide post' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
  }
}

async function handleAction({
  id,
  post,
  dismiss,
  onReply,
  setReferences,
}: {
  id: string;
  post: db.Post;
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  setReferences: (references: Record<string, ContentReference | null>) => void;
}) {
  const [path, reference] = logic.postToContentReference(post);

  switch (id) {
    case 'startThread':
      // give the actions time to fade out before navigating
      setTimeout(() => onReply?.(post), 50);
      break;
    case 'quote':
      setReferences({ [path]: reference });
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
