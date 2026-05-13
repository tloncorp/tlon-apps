import * as db from '@tloncorp/shared/db';
import { A2UI } from '@tloncorp/shared/logic';
import { Text } from '@tloncorp/ui';
import { ComponentProps, useCallback } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { CHAT_REF_LIKE_MAX_WIDTH } from '../../../constants';
import { getPostImageViewerId } from '../../../utils/mediaViewer';
import AuthorRow from '../AuthorRow';
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
    async (action: A2UI.Button['action'], fallbackText: string) => {
      if (action.event.name !== A2UI.action.sendMessage) {
        return;
      }

      if (!draftInputContext || draftInputContext.canStartDraft === false) {
        return;
      }

      const message = action.event.context?.text ?? fallbackText;
      const text = message.trim();
      if (!text) {
        return;
      }

      await draftInputContext.sendPostFromDraft({
        channelId: draftInputContext.channel.id,
        content: [text],
        attachments: [],
        channelType: draftInputContext.channel.type,
        replyToPostId: null,
        isEdit: false,
      });
    },
    [draftInputContext]
  );

  const content = usePostContent(post);
  const lastEditContent = usePostLastEditContent(post);
  const canHandleA2UIAction =
    !!draftInputContext && draftInputContext.canStartDraft !== false;

  const shouldRenderReplies =
    showReplies && post.replyCount && post.replyTime && post.replyContactIds;

  const shouldRenderReplySummary =
    shouldRenderReplies || (!showAuthor && post.isEdited);

  return (
    <YStack key={post.id}>
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
            onA2UIAction={handleA2UIAction}
            canHandleA2UIAction={canHandleA2UIAction}
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
