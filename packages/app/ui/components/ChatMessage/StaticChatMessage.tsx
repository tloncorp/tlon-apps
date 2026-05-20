import * as db from '@tloncorp/shared/db';
import { A2UI } from '@tloncorp/shared/logic';
import { ConfirmDialog, Text } from '@tloncorp/ui';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { CHAT_REF_LIKE_MAX_WIDTH } from '../../../constants';
import { getPostImageViewerId } from '../../../utils/mediaViewer';
import AuthorRow from '../AuthorRow';
import { A2UIBlock } from '../PostContent/A2UIBlock';
import { DefaultRendererProps } from '../PostContent/BlockRenderer';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import {
  usePostContent,
  usePostLastEditContent,
} from '../PostContent/contentUtils';
import { SentTimeText } from '../SentTimeText';
import { useDraftInputContext } from '../draftInputs/shared';
import { ChatMessageDeliveryStatus } from './ChatMessageDeliveryStatus';
import { ChatMessageHighlight } from './ChatMessageHighlight';
import { ChatMessageReplySummary } from './ChatMessageReplySummary';
import { ReactionsDisplay } from './ReactionsDisplay';
import {
  getA2UIConfirmationDescription,
  getA2UIDestinationLabel,
  getA2UISendText,
  isA2UIRenderableChatContext,
} from './a2uiActions';

type PendingA2UIAction = {
  action: A2UI.Button['action'];
  buttonLabel: string;
  sendText: string;
  destination: string;
};

/**
 * Renders a chat message with minimal interactivity (no pressable, no overflow
 * menu). For a fully interactive chat message view, see
 * [`ChatMessage`](packages/app/ui/components/ChatMessage/ChatMessage.tsx).
 */
export function StaticChatMessage({
  displayDebugMode = false,
  hideProfilePreview,
  hideSentAtTimestamp,
  isHighlighted,
  onLongPress,
  onPressImage,
  onPressReplies,
  onPressRetry,
  post,
  searchQuery,
  setViewReactionsPost,
  showAuthor,
  showReplies,
}: {
  authorRowProps?: Partial<ComponentProps<typeof AuthorRow>>;
  displayDebugMode?: boolean;
  hideProfilePreview?: boolean;
  hideSentAtTimestamp?: boolean;
  isHighlighted?: boolean;
  onLongPress?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  post: db.Post;
  searchQuery?: string;
  setViewReactionsPost?: (post: db.Post) => void;
  showAuthor?: boolean;
  showReplies?: boolean;
}) {
  const isNotice = post.type === 'notice';
  const draftInputContext = useDraftInputContext();
  const [pendingA2UIAction, setPendingA2UIAction] =
    useState<PendingA2UIAction | null>(null);

  if (isNotice) {
    showAuthor = false;
  }

  const deliveryFailed =
    post.deliveryStatus === 'failed' ||
    post.editStatus === 'failed' ||
    post.deleteStatus === 'failed';

  const handleRepliesPressed = useCallback(() => {
    onPressReplies?.(post);
  }, [onPressReplies, post]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  const handleImagePressed = useCallback(
    (uri: string) => {
      onPressImage?.(post, uri);
    },
    [onPressImage, post]
  );

  const handleRetryPressed = useCallback(async () => {
    try {
      await onPressRetry?.(post);
    } catch (e) {
      console.error('Failed to retry post', e);
    }
  }, [onPressRetry, post]);

  const handleA2UIAction = useCallback(
    (
      action: A2UI.Button['action'],
      fallbackText: string,
      buttonLabel: string
    ) => {
      if (action.event.name !== A2UI.action.sendMessage) {
        return;
      }

      if (!draftInputContext || draftInputContext.canStartDraft === false) {
        return;
      }

      const text = getA2UISendText(action, fallbackText);
      if (!text) {
        return;
      }

      setPendingA2UIAction({
        action,
        buttonLabel: buttonLabel.trim() || fallbackText.trim(),
        sendText: text,
        destination: getA2UIDestinationLabel({
          channel: draftInputContext.channel,
          group: draftInputContext.group,
        }),
      });
    },
    [draftInputContext]
  );

  const handleConfirmA2UIAction = useCallback(() => {
    if (!pendingA2UIAction || !draftInputContext) {
      return;
    }

    const actionToSend = pendingA2UIAction;
    setPendingA2UIAction(null);

    draftInputContext
      .sendPostFromDraft({
        channelId: draftInputContext.channel.id,
        content: [actionToSend.sendText],
        attachments: [],
        channelType: draftInputContext.channel.type,
        replyToPostId: draftInputContext.replyToPost?.id ?? null,
        isEdit: false,
      })
      .catch((e) => {
        console.error('Failed to send A2UI action', e);
      });
  }, [draftInputContext, pendingA2UIAction]);

  const canRenderA2UI = isA2UIRenderableChatContext({
    channel: draftInputContext?.channel,
    postChannelId: post.channelId,
    searchQuery,
  });
  const canHandleA2UIAction =
    canRenderA2UI &&
    !!draftInputContext &&
    draftInputContext.canStartDraft !== false;

  const a2uiConfirmationDescription = pendingA2UIAction
    ? getA2UIConfirmationDescription({
        actionName: pendingA2UIAction.action.event.name,
        buttonLabel: pendingA2UIAction.buttonLabel,
        sendText: pendingA2UIAction.sendText,
        destination: pendingA2UIAction.destination,
      })
    : '';

  const postContent = usePostContent(post);
  const lastEditPostContent = usePostLastEditContent(post);
  const content = useMemo(
    () =>
      canRenderA2UI
        ? postContent
        : postContent.filter((block) => block.type !== 'a2ui'),
    [canRenderA2UI, postContent]
  );
  const lastEditContent = useMemo(
    () =>
      canRenderA2UI
        ? lastEditPostContent
        : lastEditPostContent.filter((block) => block.type !== 'a2ui'),
    [canRenderA2UI, lastEditPostContent]
  );

  const shouldRenderReplies =
    showReplies && post.replyCount && post.replyTime && post.replyContactIds;

  const shouldRenderReplySummary =
    shouldRenderReplies || (!showAuthor && post.isEdited);

  return (
    <YStack key={post.id}>
      <ConfirmDialog
        title="Confirm A2UI action"
        description={a2uiConfirmationDescription}
        confirmText="Send message"
        open={!!pendingA2UIAction}
        onOpenChange={(open) => {
          if (!open) {
            setPendingA2UIAction(null);
          }
        }}
        onConfirm={handleConfirmA2UIAction}
      />
      {isHighlighted && <ChatMessageHighlight active={isHighlighted} />}
      {showAuthor ? (
        <AuthorRow
          padding="$l"
          paddingBottom="$2xs"
          author={post.author}
          authorId={post.authorId}
          sent={post.sentAt ?? 0}
          type={post.type}
          isBot={post.isBot ?? undefined}
          disabled={hideProfilePreview}
          editStatus={post.editStatus}
          deleteStatus={post.deleteStatus}
          showEditedIndicator={!!post.isEdited}
        />
      ) : null}

      {!hideSentAtTimestamp && !showAuthor && (
        <SentTimeText
          sentAt={post.sentAt}
          color="$tertiaryText"
          position="absolute"
          top={12}
          left={5}
        />
      )}

      {!!post.deliveryStatus && post.deliveryStatus !== 'failed' ? (
        <View
          pointerEvents="none"
          position="absolute"
          right={12}
          top={8}
          zIndex={199}
        >
          <ChatMessageDeliveryStatus status={post.deliveryStatus} />
        </View>
      ) : null}

      <View paddingLeft={!isNotice ? '$4xl' : undefined}>
        {displayDebugMode ? (
          <Text color="$green" size="$body" padding="$xl">
            {JSON.stringify(
              {
                seq: post.sequenceNum,
                id: post.id,
                sentAt: post.sentAt,
                channelId: post.channelId,
                authorId: post.authorId,
                deliveryStatus: post.deliveryStatus,
                blob: post.blob,
              },
              null,
              2
            )}
          </Text>
        ) : (
          <ChatContentRenderer
            content={post.editStatus === 'failed' ? lastEditContent : content}
            isNotice={post.type === 'notice'}
            onPressImage={handleImagePressed}
            getImageViewerId={(src) => getPostImageViewerId(post.id, src)}
            onLongPress={handleLongPress}
            onA2UIAction={canHandleA2UIAction ? handleA2UIAction : undefined}
            searchQuery={searchQuery}
          />
        )}
      </View>

      {post.reactions && post.reactions.length > 0 && (
        <View paddingBottom="$l" paddingLeft="$4xl">
          <ReactionsDisplay
            post={post}
            onViewPostReactions={setViewReactionsPost}
          />
        </View>
      )}

      {shouldRenderReplySummary || deliveryFailed ? (
        <XStack paddingLeft={'$4xl'} paddingRight="$l" paddingBottom="$l">
          <ChatMessageReplySummary
            post={post}
            onPress={shouldRenderReplies ? handleRepliesPressed : undefined}
            showEditedIndicator={!showAuthor && !!post.isEdited}
            deliveryFailed={deliveryFailed}
            onPressRetry={handleRetryPressed}
          />
        </XStack>
      ) : null}
    </YStack>
  );
}

const WebChatImageRenderer: DefaultRendererProps['image'] = {
  alignItems: 'flex-start',
  imageProps: {
    maxWidth: 600,
    maxHeight: 400,
  },
};

const WebChatVideoRenderer: DefaultRendererProps['video'] = {
  alignItems: 'flex-start',
  maxWidth: 600,
  maxHeight: 400,
};

const ChatContentRenderer = createContentRenderer({
  blockRenderers: {
    a2ui: A2UIBlock,
  },
  blockSettings: {
    blockWrapper: {
      paddingLeft: 0,
    },
    reference: {
      contentSize: '$l',
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
    },
    image: isWeb ? WebChatImageRenderer : undefined,
    video: isWeb ? WebChatVideoRenderer : undefined,
    link: {
      renderDescription: true,
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
      imageProps: {
        aspectRatio: 2,
      },
    },
    code: {
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
    },
    file: {
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
    },
    voicememo: {
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
    },
  },
});
