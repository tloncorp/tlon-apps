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
  postActions,
  onEdit,
  onViewReactions,
}: {
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  post: db.Post;
  postActions: ChannelAction[];
}) {
  const currentSession = useCurrentSession();
  const currentUserId = useCurrentUserId();
  const { addAttachment } = useAttachmentContext();
  const channel = useChannelContext();

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
