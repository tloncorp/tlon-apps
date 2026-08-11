import { JSONContent } from '@tloncorp/api/urbit';
import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Attachment } from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCopy } from '@tloncorp/ui';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { isWeb } from 'tamagui';

import { useCurrentUserId } from '../../../contexts/appDataContext';
import { useAttachmentContext } from '../../../contexts/attachment';
import { useChannelContext } from '../../../contexts/channel';
import { triggerHaptic, useIsAdmin } from '../../../utils';
import ActionList from '../../ActionList';
import { getOwnContextLensStamp } from '../../Channel/ContextLens/lensPost';
import { useContextLensAvailable } from '../../Channel/ContextLens/useContextLensStore';
import { useForwardPostSheet } from '../../ForwardPostSheet';
import {
  DraftInputContext,
  useDraftInputContext,
} from '../../draftInputs/shared';
import {
  MessageMenuActionDescriptor,
  MessageMenuActionId,
  isMessageActionVisible,
  messageActionToken,
  messageContentKey,
} from './messageActionModel';

export type {
  MessageMenuActionDescriptor,
  MessageMenuActionId,
} from './messageActionModel';

const ENABLE_COPY_JSON = __DEV__;

type DraftTextTarget = Pick<
  DraftInputContext,
  'getDraft' | 'startDraft' | 'storeDraft'
>;

type RunAfterDismiss = (action: () => void) => void;

export default function MessageActions({
  dismiss,
  onReply,
  post,
  postActionIds,
  onEdit,
  onViewReactions,
  onViewBotRun,
}: {
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  onViewBotRun?: (post: db.Post) => void;
  post: db.Post;
  postActionIds: ChannelAction.Id[];
}) {
  const runAfterDismiss = useCallback(
    (action: () => void) => {
      if (Platform.OS === 'ios') {
        dismiss();
        setTimeout(action, 300);
      } else {
        action();
        dismiss();
      }
    },
    [dismiss]
  );
  const { actions, performAction } = useMessageActionModel({
    dismiss,
    runAfterDismiss,
    onReply,
    onEdit,
    onViewReactions,
    onViewBotRun,
    post,
    postActionIds,
  });

  // arbitrary width that looks reasonable given labels
  const width = isWeb ? 'auto' : 220;
  return (
    <ActionList width={width}>
      {actions.map((action, index) => (
        <ActionList.Action
          key={action.id}
          height="auto"
          actionType={action.actionType}
          last={index === actions.length - 1 && !__DEV__}
          onPress={() => performAction(action.id)}
        >
          {action.title}
        </ActionList.Action>
      ))}
      {ENABLE_COPY_JSON ? <CopyJsonAction post={post} /> : null}
    </ActionList>
  );
}

const systemImageForAction: Partial<Record<MessageMenuActionId, string>> = {
  startThread: 'arrowshape.turn.up.left',
  replyToComment: 'arrowshape.turn.up.left',
  quote: 'quote.bubble',
  edit: 'pencil',
  copyText: 'doc.on.doc',
  copyRef: 'link',
  forward: 'arrowshape.turn.up.right',
  viewReactions: 'face.smiling',
  muteThread: 'bell.slash',
  pinPost: 'pin',
  unpinPost: 'pin.slash',
  visibility: 'eye.slash',
  report: 'exclamationmark.bubble',
  delete: 'trash',
  debugJson: 'ladybug',
  viewBotRun: 'sparkles',
};

export function useMessageActionModel({
  dismiss,
  onEdit,
  onReply,
  onViewReactions,
  onViewBotRun,
  post,
  postActionIds,
  runAfterDismiss,
}: {
  post: db.Post;
  postActionIds: ChannelAction.Id[];
  dismiss: () => void;
  onReply?: (post: db.Post) => void;
  onEdit?: () => void;
  onViewReactions?: (post: db.Post) => void;
  onViewBotRun?: (post: db.Post) => void;
  runAfterDismiss: RunAfterDismiss;
}) {
  const currentUserId = useCurrentUserId();
  const connectionStatus = store.useConnectionStatus();
  const channel = useChannelContext();
  const { addAttachment } = useAttachmentContext();
  const draftInputContext = useDraftInputContext();
  const currentUserIsAdmin = useIsAdmin(post.groupId ?? '', currentUserId);
  const { open: forwardPost } = useForwardPostSheet();
  const pinnedPostId = logic.getPinnedPostId(channel);
  const contextLensAvailable = useContextLensAvailable();
  const { data: ownedBotShips } = store.useContextLensBotShips();
  const showViewBotRun = Boolean(
    contextLensAvailable &&
      onViewBotRun &&
      getOwnContextLensStamp(post, ownedBotShips ?? [])
  );

  const contentKey = messageContentKey(post);
  const actions = useMemo<MessageMenuActionDescriptor[]>(() => {
    const isConnected = connectionStatus === 'Connected';
    const canStartDraft = Boolean(draftInputContext?.canStartDraft);
    const descriptors = postActionIds.flatMap<MessageMenuActionDescriptor>(
      (id) => {
        const action = ChannelAction.staticSpecForId(id);
        if (
          !isMessageActionVisible(id, {
            isNetworkDependent: Boolean(action.isNetworkDependent),
            isConnected,
            currentUserId,
            currentUserIsAdmin,
            canStartDraft,
            channelType: channel.type,
            pinnedPostId,
            post: {
              id: post.id,
              authorId: post.authorId,
              parentId: post.parentId,
              deliveryStatus: post.deliveryStatus,
              replyCount: post.replyCount,
              reactionCount: post.reactions?.length ?? 0,
            },
          })
        ) {
          return [];
        }
        const { label } = displaySpecForChannelActionId(id, {
          post,
          channel,
          currentUserId,
          currentUserIsAdmin,
        });
        const descriptor = {
          id,
          title: label,
          systemImage: systemImageForAction[id],
          destructive: id === 'delete' || id === 'report',
          actionType: action.actionType,
        };
        return [
          {
            ...descriptor,
            token: messageActionToken(post, contentKey, descriptor),
          },
        ];
      }
    );
    if (showViewBotRun) {
      const descriptor = {
        id: 'viewBotRun',
        title: 'View bot run',
        systemImage: systemImageForAction.viewBotRun,
      } as const;
      descriptors.push({
        ...descriptor,
        token: messageActionToken(post, contentKey, descriptor),
      });
    }
    return descriptors;
  }, [
    postActionIds,
    connectionStatus,
    showViewBotRun,
    post,
    contentKey,
    channel,
    currentUserId,
    currentUserIsAdmin,
    pinnedPostId,
    draftInputContext?.canStartDraft,
  ]);

  const performAction = useCallback(
    (id: MessageMenuActionId, token?: string) => {
      if (
        token &&
        actions.find((action) => action.id === id)?.token !== token
      ) {
        return;
      }
      if (id === 'viewBotRun') {
        if (!onViewBotRun) {
          return;
        }
        runAfterDismiss(() => onViewBotRun(post));
        return;
      }

      const actionArgs = {
        id,
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
        draftTextTarget: draftInputContext
          ? {
              getDraft: draftInputContext.getDraft,
              startDraft: draftInputContext.startDraft,
              storeDraft: draftInputContext.storeDraft,
            }
          : null,
        runAfterDismiss,
      };
      if (id === 'delete') {
        const postTerm = postTermForChannel(channel);
        confirmDeleteAction(postTerm, () => {
          void handleAction(actionArgs);
        });
        return;
      }
      void handleAction(actionArgs);
    },
    [
      addAttachment,
      actions,
      channel,
      currentUserId,
      dismiss,
      draftInputContext,
      forwardPost,
      onEdit,
      onReply,
      onViewBotRun,
      onViewReactions,
      post,
      runAfterDismiss,
    ]
  );

  return { actions, contentKey, performAction };
}

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
  draftTextTarget,
  runAfterDismiss,
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
  draftTextTarget?: DraftTextTarget | null;
  runAfterDismiss: RunAfterDismiss;
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
        await prependTextToDraft(draftTextTarget, `> ${post.textContent}\n`);
      } else {
        // For other channel types, use reference attachment
        addAttachment({ type: 'reference', reference, path });
      }
      break;
    case 'replyToComment':
      await prependMentionToDraft(draftTextTarget, post.authorId);
      break;
    case 'edit':
      onEdit?.();
      break;
    case 'copyRef':
      await Clipboard.setStringAsync(logic.getPostReferencePath(post));
      break;
    case 'copyText': {
      let text: string;
      try {
        text = logic.plaintextPreviewOf(
          logic.convertContent(post.content, post.blob),
          {
            ...logic.PlaintextPreviewConfig.defaultConfig,
            includeRefTag: false,
          }
        );
      } catch (e) {
        // convertContent throws on unrecognized block types (e.g. content
        // written by a newer client); fall back to the stored preview.
        text = post.textContent ?? '';
      }
      await Clipboard.setStringAsync(text);
      break;
    }
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
      runAfterDismiss(() => onForward?.(post));
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
  ctx: DraftTextTarget | null | undefined,
  text: string
) {
  // DM quote actions should be rendered with the active draft text target.
  // Missing target means the provider wiring is wrong, not that we should fall back to refs.
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
  ctx.startDraft?.();
}

async function prependMentionToDraft(
  ctx: DraftTextTarget | null | undefined,
  authorId: string
) {
  if (!ctx) {
    throw new Error('Cannot prepend mention without a draft input context');
  }

  const draft = await ctx.getDraft();
  const firstChild = draft?.content?.[0]?.content?.[0];
  // No-op if the draft already starts with this mention.
  if (firstChild?.type === 'mention' && firstChild.attrs?.id === authorId) {
    ctx.startDraft?.();
    return;
  }

  const mentionNode: JSONContent = {
    type: 'mention',
    attrs: { id: authorId },
  };
  const spaceNode: JSONContent = { type: 'text', text: ' ' };

  // Splice the mention + space into the first paragraph of the existing
  // draft. Editing the JSON directly preserves the trailing space, which
  // textAndMentionsToContent would otherwise trim away on an empty draft.
  const existingDocContent = draft?.content ?? [];
  const [firstBlock, ...restBlocks] = existingDocContent;
  const firstParagraphContent =
    firstBlock?.type === 'paragraph' ? firstBlock.content ?? [] : [];

  const nextFirstParagraph: JSONContent = {
    type: 'paragraph',
    content: [mentionNode, spaceNode, ...firstParagraphContent],
  };
  const nextDocContent =
    firstBlock?.type === 'paragraph'
      ? [nextFirstParagraph, ...restBlocks]
      : [nextFirstParagraph, ...existingDocContent];

  await ctx.storeDraft({
    ...(draft ?? { type: 'doc' }),
    content: nextDocContent,
  });
  ctx.startDraft?.();
}

/**
 * Extra information about how to display the action. This can change based on
 * the UI context - e.g. the label for `startThread` changes based on channel
 * type.
 */
export function displaySpecForChannelActionId(
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
  const postTerm = postTermForChannel(channel);

  const spec = (() => {
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

      case 'replyToComment':
        return { label: 'Reply' };

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
  })();

  return { ...spec, postTerm };
}

function postTermForChannel(channel: db.Channel) {
  return ['dm', 'groupDm', 'chat'].includes(channel.type) ? 'message' : 'post';
}
