import Clipboard from '@react-native-clipboard/clipboard';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';

import { ActionList } from '../ActionList';

export default function ChatMessageMenu({
  dismiss,
  channelType,
  post,
}: {
  dismiss: () => void;
  post: db.PostInsert;
  channelType: db.ChannelType;
}) {
  const postActions = getPostActions(post, channelType);

  return (
    // arbitrary width that looks reasonable given labels
    <ActionList width={220}>
      {postActions.map((action, index) => (
        <ActionList.Action
          onPress={() => handleAction({ id: action.id, post, dismiss })}
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
  post: db.PostInsert,
  channelType: db.ChannelType
): ChannelAction[] {
  switch (channelType) {
    case 'gallery':
      return [
        { id: 'reply', label: 'Comment on post' },
        { id: 'copyRef', label: 'Copy link to post' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
    case 'notebook':
      return [
        { id: 'reply', label: 'Comment on post' },
        { id: 'pin', label: 'Pin post' },
        { id: 'copyRef', label: 'Copy link to post' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
    case 'dm':
    case 'groupDm':
      return [
        { id: 'reply', label: 'Reply' },
        { id: 'startThread', label: 'Start thread' },
        { id: 'copyText', label: 'Copy message text' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
    case 'chat':
    default:
      return [
        { id: 'reply', label: 'Reply' },
        { id: 'startThread', label: 'Start thread' },
        { id: 'copyRef', label: 'Copy link to message' },
        { id: 'copyText', label: 'Copy message text' },
        { id: 'edit', label: 'Edit message' },
        { id: 'visibility', label: 'Hide' },
        { id: 'delete', label: 'Delete message', actionType: 'destructive' },
      ];
  }
}

async function handleAction({
  id,
  post,
  dismiss,
}: {
  id: string;
  post: db.PostInsert;
  dismiss: () => void;
}) {
  switch (id) {
    case 'copyRef':
      Clipboard.setString(logic.getPostReferencePath(post));
      break;
    case 'copyText':
      Clipboard.setString(post.textContent ?? '');
      break;
    case 'delete':
      store.deletePost({ channelId: post.channelId, postId: post.id });
      break;
    case 'visibility':
      store.togglePost({ channelId: post.channelId, postId: post.id });
  }

  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  dismiss();
}
