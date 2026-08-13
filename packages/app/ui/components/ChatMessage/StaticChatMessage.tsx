import { isDmChannelId } from '@tloncorp/api/client';
import * as db from '@tloncorp/shared/db';
import {
  A2UI,
  appendToPostBlob,
  convertContent,
  getRandomId,
  parsePostBlob,
} from '@tloncorp/shared/logic';
import {
  renameAgentGroupFromOnboarding,
  useGroup,
} from '@tloncorp/shared/store';
import { Text } from '@tloncorp/ui';
import { ComponentProps, useCallback, useEffect, useMemo } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { CHAT_REF_LIKE_MAX_WIDTH } from '../../../constants';
import { useA2UINavigation } from '../../../hooks/useA2UINavigation';
import { getPostImageViewerId } from '../../../utils/mediaViewer';
import { useCurrentUserId } from '../../contexts/appDataContext';
import type { A2UIActionCompletion } from '../../contexts/componentsKits';
import AuthorRow from '../AuthorRow';
import { ContextLensBadge } from '../Channel/ContextLens/ContextLensBadge';
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

/**
 * Renders a chat message with minimal interactivity (no pressable, no overflow
 * menu). For a fully interactive chat message view, see
 * [`ChatMessage`](packages/app/ui/components/ChatMessage/ChatMessage.tsx).
 */
export function StaticChatMessage({
  a2uiActionCompletion,
  displayDebugMode = false,
  hideProfilePreview,
  hideSentAtTimestamp,
  isHighlighted,
  onLongPress,
  onPressBotRun,
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
  a2uiActionCompletion?: A2UIActionCompletion;
  displayDebugMode?: boolean;
  hideProfilePreview?: boolean;
  hideSentAtTimestamp?: boolean;
  isHighlighted?: boolean;
  onLongPress?: (post: db.Post) => void;
  onPressBotRun?: (post: db.Post) => void;
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
  const navigateToA2UITarget = useA2UINavigation();
  const currentUserId = useCurrentUserId();
  const { data: group } = useGroup({ id: post.groupId ?? '' });

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

  const sendAgentProvision = useCallback(
    async (plan: A2UI.AgentOnboardingPlan, expectedGroupId?: string) => {
      if (!draftInputContext) {
        throw new Error('This channel is not ready to send messages');
      }
      const currentGroup = group ?? draftInputContext.group;
      const groupId = post.groupId ?? currentGroup?.id;
      if (
        !groupId ||
        currentGroup?.id !== groupId ||
        (expectedGroupId && expectedGroupId !== groupId)
      ) {
        throw new Error('The onboarding group is not available');
      }
      // Channel creation is persisted separately from the group's embedded
      // channel list, which can lag behind the live channel table for this
      // render. Resolve the notebook from the canonical table at action time.
      const notebooks = (await db.getAllChannels()).filter(
        (channel) => channel.groupId === groupId && channel.type === 'notes'
      );
      if (notebooks.length !== 1) {
        throw new Error('The onboarding group needs exactly one notebook');
      }

      const locks = await db.agentGroupOnboardingLocks.getValue();
      const provisionId =
        locks[groupId]?.provision?.provisionId ??
        `${getRandomId()}-${Date.now().toString(36)}`;
      const blob = appendToPostBlob(undefined, {
        type: 'tlon-agent-provision',
        version: 1,
        provisionId,
        groupId,
        purposeId: plan.purposeId,
        purpose: plan.purpose,
        topics: plan.topics,
        timezone: plan.timezone,
        scheduleHour: plan.scheduleHour,
        scheduleMinute: plan.scheduleMinute,
        notebookNest: notebooks[0].id,
      });

      await renameAgentGroupFromOnboarding({
        groupId,
        purposeId: plan.purposeId,
        topics: plan.topics,
      });

      await db.agentGroupOnboardingLocks.setValue((current) => ({
        ...current,
        [groupId]: {
          ...current[groupId],
          createdAt: current[groupId]?.createdAt ?? Date.now(),
          provision: {
            type: 'tlon-agent-provision',
            version: 1,
            provisionId,
            groupId,
            purposeId: plan.purposeId,
            purpose: plan.purpose,
            topics: plan.topics,
            timezone: plan.timezone,
            scheduleHour: plan.scheduleHour,
            scheduleMinute: plan.scheduleMinute,
            notebookNest: notebooks[0].id,
          },
        },
      }));
      await draftInputContext.sendPostFromDraft({
        channelId: draftInputContext.channel.id,
        content: [plan.topics.join(', ')],
        attachments: [],
        blob,
        channelType: draftInputContext.channel.type,
        replyToPostId: null,
        isEdit: false,
      });
    },
    [draftInputContext, group, post.groupId]
  );

  const handleA2UIAction = useCallback(
    async (action: A2UI.Button['action']) => {
      if (action.event.name === A2UI.action.navigate) {
        await navigateToA2UITarget(action.event.context.target);
        return;
      }

      if (action.event.name === A2UI.action.inviteLink) {
        return;
      }

      if (action.event.name === A2UI.action.provisionAgent) {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        await sendAgentProvision(
          { ...action.event.context, timezone },
          action.event.context.groupId
        );
        return;
      }

      if (!draftInputContext || draftInputContext.canStartDraft === false) {
        return;
      }

      const text = action.event.context.text.trim();
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
    [draftInputContext, navigateToA2UITarget, sendAgentProvision]
  );

  const isA2UIActionAvailable = useCallback(
    (action: A2UI.Button['action']) => {
      if (action.event.name === A2UI.action.navigate) {
        return true;
      }

      if (action.event.name === A2UI.action.inviteLink) {
        return Boolean(
          post.groupId && action.event.context.groupId === post.groupId
        );
      }

      if (action.event.name === A2UI.action.sendMessage) {
        return Boolean(
          draftInputContext &&
          draftInputContext.canStartDraft !== false &&
          action.event.context.text.trim()
        );
      }

      if (action.event.name === A2UI.action.provisionAgent) {
        const currentGroup = group ?? draftInputContext?.group;
        const groupId = post.groupId ?? currentGroup?.id;
        // Furnishing creates the notebook before the bot can post this
        // action. Do not leave the action visually disabled while the group's
        // denormalized channel relation catches up; submission validates the
        // canonical channel table above.
        return Boolean(
          draftInputContext &&
            groupId &&
            currentGroup?.id === groupId &&
            action.event.context.groupId === groupId
        );
      }

      return false;
    },
    [draftInputContext, group, post.groupId]
  );

  const isA2UIActionConsumed = useCallback(
    (action: A2UI.Button['action']) => {
      if (action.event.name === A2UI.action.sendMessage) {
        return a2uiActionCompletion?.sendMessage === true;
      }
      if (action.event.name === A2UI.action.provisionAgent) {
        return a2uiActionCompletion?.provisionAgent === true;
      }
      return false;
    },
    [a2uiActionCompletion]
  );

  const confirmOnboarding = useCallback(
    (plan: A2UI.AgentOnboardingPlan) => sendAgentProvision(plan),
    [sendAgentProvision]
  );

  const groupAgents = db.agentGroupAgents.useValue();
  const onboardingLocks = db.agentGroupOnboardingLocks.useValue();
  const knownAgent = post.groupId ? groupAgents[post.groupId] : undefined;
  const onboardingMarker = post.groupId
    ? onboardingLocks[post.groupId]
    : undefined;
  useEffect(() => {
    if (
      !post.groupId ||
      post.authorId !== knownAgent ||
      !post.blob ||
      !onboardingMarker?.provision
    ) {
      return;
    }
    const matched = parsePostBlob(post.blob).some(
      (entry) =>
        entry.type === 'tlon-agent-post-marker' &&
        entry.key ===
          `first-entry-ping:${onboardingMarker.provision?.provisionId}`
    );
    if (!matched) return;
    void db.agentGroupOnboardingLocks.setValue((current) => {
      if (!post.groupId || !current[post.groupId]) return current;
      const { [post.groupId]: _released, ...remaining } = current;
      return remaining;
    });
  }, [knownAgent, onboardingMarker, post.authorId, post.blob, post.groupId]);
  const canRenderA2UI =
    isDmChannelId(post.channelId) ||
    Boolean(
      post.groupId &&
        group?.currentUserIsHost &&
        group.hostUserId === currentUserId &&
        knownAgent === post.authorId
    );

  const postContent = usePostContent(post);
  const lastEditPostContent = usePostLastEditContent(post);
  const blobContent = useMemo(
    () => convertContent(undefined, post.blob ?? undefined),
    [post.blob]
  );
  const hasA2UIStoryFallback = useMemo(
    () =>
      Boolean(
        post.blob &&
          parsePostBlob(post.blob).some(
            (entry) => entry.type === 'a2ui' && entry.storyMode === 'fallback'
          )
      ),
    [post.blob]
  );
  const content = useMemo(() => {
    if (!canRenderA2UI) {
      return postContent.filter((block) => block.type !== 'a2ui');
    }
    // `storyMode: fallback` declares the post story as the complete textual
    // substitute for this surface. Preserve every blob-derived attachment,
    // but omit that duplicate story when the trusted A2UI can render.
    return hasA2UIStoryFallback ? blobContent : postContent;
  }, [blobContent, canRenderA2UI, hasA2UIStoryFallback, postContent]);
  const lastEditContent = useMemo(() => {
    if (!canRenderA2UI) {
      return lastEditPostContent.filter((block) => block.type !== 'a2ui');
    }
    return hasA2UIStoryFallback ? blobContent : lastEditPostContent;
  }, [blobContent, canRenderA2UI, hasA2UIStoryFallback, lastEditPostContent]);
  const contentIsOnlyA2UI =
    content.length > 0 && content.every((block) => block.type === 'a2ui');

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
            paddingBottom={contentIsOnlyA2UI ? '$l' : undefined}
            isNotice={post.type === 'notice'}
            onPressImage={handleImagePressed}
            getImageViewerId={(src) => getPostImageViewerId(post.id, src)}
            onLongPress={handleLongPress}
            onA2UIAction={canRenderA2UI ? handleA2UIAction : undefined}
            isA2UIActionAvailable={
              canRenderA2UI ? isA2UIActionAvailable : undefined
            }
            isA2UIActionConsumed={
              canRenderA2UI ? isA2UIActionConsumed : undefined
            }
            onAgentOnboardingConfirm={
              canRenderA2UI ? confirmOnboarding : undefined
            }
            searchQuery={searchQuery}
          />
        )}
      </View>

      <ContextLensBadge post={post} onPress={onPressBotRun} />

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
    a2ui: {
      wrapperProps: {
        paddingBottom: 0,
      },
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
