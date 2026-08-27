import {
  appendToPostBlob,
  getBotUserIdForUser,
  type PostBlobDataEntryA2UISelection,
  type PostBlobDataEntryAgentProvision,
} from '@tloncorp/api';
import { isDmChannelId } from '@tloncorp/api/client';
import * as db from '@tloncorp/shared/db';
import { A2UI, convertContent, getRandomId } from '@tloncorp/shared/logic';
import {
  renameAgentGroupFromOnboarding,
  useGroup,
} from '@tloncorp/shared/store';
import * as store from '@tloncorp/shared/store';
import { Text } from '@tloncorp/ui';
import { ComponentProps, ReactNode, useCallback, useMemo } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { CHAT_REF_LIKE_MAX_WIDTH } from '../../../constants';
import { useA2UINavigation } from '../../../hooks/useA2UINavigation';
import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import { getPostImageViewerId } from '../../../utils/mediaViewer';
import type { A2UIActionCompletion } from '../../contexts/componentsKits';
import AuthorRow from '../AuthorRow';
import { ContextLensBadge } from '../Channel/ContextLens/ContextLensBadge';
import { A2UIBlock } from '../PostContent/A2UIBlock';
import { DefaultRendererProps } from '../PostContent/BlockRenderer';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import { isA2UISendMessageActionConsumed } from '../PostContent/a2uiActionConsumption';
import {
  hasRenderableA2UIStoryFallback,
  isA2UIBlockRenderable,
} from '../PostContent/a2uiRenderability';
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

function receiptFollowsPost(
  receipt:
    | { postId: string; receivedAt: number; sequenceNum: number | null }
    | undefined,
  post: db.Post
) {
  if (!receipt || receipt.postId === post.id) return false;
  if (
    receipt.sequenceNum != null &&
    receipt.sequenceNum > 0 &&
    post.sequenceNum != null &&
    post.sequenceNum > 0 &&
    receipt.sequenceNum !== post.sequenceNum
  ) {
    return receipt.sequenceNum > post.sequenceNum;
  }
  return receipt.receivedAt >= post.receivedAt;
}

function provisionMatchesPlan(
  provision: PostBlobDataEntryAgentProvision | undefined,
  plan: A2UI.ProvisionAgentEvent['context'] & { timezone: string },
  notebookNest: string,
  notebookTitle: string
) {
  return Boolean(
    provision &&
    provision.groupId === plan.groupId &&
    provision.purposeId === plan.purposeId &&
    provision.purpose === plan.purpose &&
    provision.timezone === plan.timezone &&
    provision.scheduleHour === plan.scheduleHour &&
    provision.scheduleMinute === plan.scheduleMinute &&
    provision.notebookNest === notebookNest &&
    provision.notebookTitle === notebookTitle &&
    provision.topics.length === plan.topics.length &&
    provision.topics.every((topic, index) => topic === plan.topics[index])
  );
}

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
  feedbackRow,
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
  feedbackRow?: ReactNode;
}) {
  const isNotice = post.type === 'notice';
  const draftInputContext = useDraftInputContext();
  const navigateToA2UITarget = useA2UINavigation();
  const currentUserId = useCurrentUserId();
  const { data: group } = useGroup({ id: post.groupId ?? '' });
  const groupAgents = db.agentGroupAgents.useValue();
  // A newly delivered post can arrive one render before its denormalized
  // `groupId`. The surrounding channel is authoritative for that relationship.
  const resolvedPostGroupId =
    post.groupId ??
    (draftInputContext?.channel.id === post.channelId
      ? draftInputContext.channel.groupId
      : undefined);
  const knownAgent = resolvedPostGroupId
    ? groupAgents[resolvedPostGroupId]
    : undefined;
  const currentGroup = group ?? draftInputContext?.group;
  const currentUserHostsPostGroup = Boolean(
    resolvedPostGroupId &&
    currentGroup?.currentUserIsHost &&
    currentGroup.id === resolvedPostGroupId &&
    currentGroup.hostUserId === currentUserId
  );
  const canUseAgentProviderControls =
    post.authorId === getBotUserIdForUser(currentUserId) ||
    Boolean(
      resolvedPostGroupId &&
      currentUserHostsPostGroup &&
      knownAgent === post.authorId
    );

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

  const resolveActionGroup = useCallback(
    (expectedGroupId: string) => {
      if (!draftInputContext || draftInputContext.canStartDraft === false) {
        throw new Error('This channel is not ready to send messages');
      }
      const currentGroup = group ?? draftInputContext.group;
      const groupId = post.groupId ?? currentGroup?.id;
      if (
        !groupId ||
        currentGroup?.id !== groupId ||
        expectedGroupId !== groupId
      ) {
        throw new Error('The onboarding group is not available');
      }
      return { groupId, draftInput: draftInputContext };
    },
    [draftInputContext, group, post.groupId]
  );

  const sendAgentProvision = useCallback(
    async (
      plan: A2UI.ProvisionAgentEvent['context'] & { timezone: string },
      selection?: PostBlobDataEntryA2UISelection
    ) => {
      const { groupId, draftInput } = resolveActionGroup(plan.groupId);
      // Channel creation is persisted separately from the group's embedded
      // channel list, which can lag behind the live channel table for this
      // render. Resolve the notebook from the canonical table at action time.
      const notebooks = (await db.getAllChannels()).filter(
        (channel) => channel.groupId === groupId && channel.type === 'notes'
      );
      if (notebooks.length !== 1) {
        throw new Error('The onboarding group needs exactly one notebook');
      }
      const notebookTitle = notebooks[0].title ?? 'Updates';

      const locks = await db.agentGroupOnboardingLocks.getValue();
      const existingLock = locks[groupId];
      // Reuse an id only for an exact retry of the same unacknowledged plan.
      // A different plan is a distinct coordinator request.
      const provisionId =
        existingLock?.provisionAcknowledgedAt == null &&
        provisionMatchesPlan(
          existingLock?.provision,
          { ...plan, groupId },
          notebooks[0].id,
          notebookTitle
        )
          ? existingLock?.provision?.provisionId
          : undefined;
      const request = {
        type: 'tlon-agent-provision',
        version: 1,
        provisionId:
          provisionId ?? `${getRandomId()}-${Date.now().toString(36)}`,
        groupId,
        purposeId: plan.purposeId,
        purpose: plan.purpose,
        topics: plan.topics,
        timezone: plan.timezone,
        scheduleHour: plan.scheduleHour,
        scheduleMinute: plan.scheduleMinute,
        notebookNest: notebooks[0].id,
        notebookTitle,
      } satisfies PostBlobDataEntryAgentProvision;
      const blob = selection
        ? appendToPostBlob(appendToPostBlob(undefined, request), selection)
        : appendToPostBlob(undefined, request);

      await db.agentGroupOnboardingLocks.setValue((current) => ({
        ...current,
        [groupId]: {
          ...current[groupId],
          createdAt: current[groupId]?.createdAt ?? Date.now(),
          provisionAcknowledgedAt: undefined,
          provision: request,
        },
      }));
      // A definitive failure leaves a retryable timeline row. Treat that row
      // as the sole retry path and keep the source control consumed.
      await draftInput.sendPostFromDraft({
        channelId: draftInput.channel.id,
        content: [plan.topics.join(', ')],
        attachments: [],
        blob,
        channelType: draftInput.channel.type,
        replyToPostId: null,
        isEdit: false,
      });
      await renameAgentGroupFromOnboarding({
        groupId,
        purposeId: plan.purposeId,
        topics: plan.topics,
      });
    },
    [resolveActionGroup]
  );

  const configureAgentProviders = useCallback(
    async (groupId: string, provisionId: string, providerIds: string[]) => {
      if (!draftInputContext || draftInputContext.canStartDraft === false) {
        throw new Error('This channel is not ready to send messages');
      }
      const currentGroupId =
        post.groupId ??
        draftInputContext.group?.id ??
        draftInputContext.channel.groupId;
      if (currentGroupId && currentGroupId !== groupId) {
        throw new Error('The agent group is not available');
      }
      const targetGroup = await db.getGroup({ id: groupId });
      if (!targetGroup?.currentUserIsHost) {
        throw new Error('The agent group is not available');
      }
      const uniqueProviderIds = [...new Set(providerIds)];
      const blob = appendToPostBlob(undefined, {
        type: 'tlon-agent-provider-config',
        version: 1,
        provisionId,
        groupId,
        providerIds: uniqueProviderIds,
      });
      const content = uniqueProviderIds.length
        ? `Use ${uniqueProviderIds.join(', ')} for this group’s future entries.`
        : 'Do not use connected services for this group’s future entries.';
      await draftInputContext.sendPostFromDraft({
        channelId: draftInputContext.channel.id,
        content: [content],
        attachments: [],
        blob,
        channelType: draftInputContext.channel.type,
        replyToPostId: null,
        isEdit: false,
      });
    },
    [draftInputContext, post.groupId]
  );

  const handleA2UIAction = useCallback(
    async (action: A2UI.Action, selection?: PostBlobDataEntryA2UISelection) => {
      if (action.event.name === A2UI.action.navigate) {
        await navigateToA2UITarget(action.event.context.target, {
          allowBotMcpSettings: canUseAgentProviderControls,
          allowBrowserCredentialHandoff: canUseAgentProviderControls,
        });
        return;
      }

      if (action.event.name === A2UI.action.provisionAgent) {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        await sendAgentProvision(
          { ...action.event.context, timezone },
          selection
        );
        return;
      }

      if (action.event.name === A2UI.action.configureAgentProviders) {
        await configureAgentProviders(
          action.event.context.groupId,
          action.event.context.provisionId,
          action.event.context.providerIds
        );
        return;
      }

      if (action.event.name !== A2UI.action.sendMessage) {
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
        blob: selection ? appendToPostBlob(undefined, selection) : undefined,
        channelType: draftInputContext.channel.type,
        replyToPostId: null,
        isEdit: false,
      });
    },
    [
      canUseAgentProviderControls,
      configureAgentProviders,
      draftInputContext,
      navigateToA2UITarget,
      sendAgentProvision,
    ]
  );

  const isA2UIActionAvailable = useCallback(
    (action: A2UI.Action) => {
      if (action.event.name === A2UI.action.navigate) {
        const target = action.event.context.target;
        if (target.type !== 'screen') return true;
        return canUseAgentProviderControls;
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
          draftInputContext.canStartDraft !== false &&
          groupId &&
          currentGroup?.id === groupId &&
          action.event.context.groupId === groupId
        );
      }

      if (action.event.name === A2UI.action.configureAgentProviders) {
        const currentGroupId =
          post.groupId ??
          draftInputContext?.group?.id ??
          draftInputContext?.channel.groupId;
        return Boolean(
          canUseAgentProviderControls &&
          draftInputContext &&
          draftInputContext.canStartDraft !== false &&
          (!currentGroupId || action.event.context.groupId === currentGroupId)
        );
      }

      return false;
    },
    [canUseAgentProviderControls, draftInputContext, group, post.groupId]
  );

  // `useGroup()` can briefly clear its query result while a live post is
  // inserted. The surrounding channel already owns the same group, so keep
  // authorization stable through that refresh instead of flashing the text
  // fallback before replacing it with A2UI.
  const canRenderA2UI =
    isDmChannelId(post.channelId) ||
    Boolean(
      resolvedPostGroupId &&
      currentUserHostsPostGroup &&
      knownAgent === post.authorId
    );

  const postContent = usePostContent(post);
  const hasA2UIContent = useMemo(
    () => postContent.some((block) => block.type === 'a2ui'),
    [postContent]
  );
  const hasRenderableA2UIContent = useMemo(
    () =>
      postContent.some(
        (block) =>
          block.type === 'a2ui' &&
          isA2UIBlockRenderable(block, canUseAgentProviderControls)
      ),
    [canUseAgentProviderControls, postContent]
  );
  // One live query per channel (deduped across messages); the posts-table
  // dependency re-runs it when the viewer's reply lands, including the
  // optimistic insert, so an answered control stays locked across remounts.
  const a2uiSelections = store.useA2UISelections({
    channelId: post.channelId,
    authorId: currentUserId,
    enabled: canRenderA2UI && hasA2UIContent,
  });
  const agentProtocolReceipts = store.useAgentA2UIProtocolReceipts({
    channelId: post.channelId,
    authorId: currentUserId,
    enabled: canRenderA2UI && hasA2UIContent,
  });
  const provisionReceipts = agentProtocolReceipts.data?.provisions;
  const providerConfigReceipts = agentProtocolReceipts.data?.providerConfigs;
  // Selection-aware provision replies are consumed by their exact source
  // post/surface/component via useA2UISelections below. Only legacy replies
  // without a selection use the positional fallback.
  const durableProvision = [...(provisionReceipts ?? [])]
    .reverse()
    .find(
      (receipt) => !receipt.selection && receiptFollowsPost(receipt, post)
    )?.entry;
  const provisionedAgentTopics = durableProvision?.topics;
  const getConfiguredAgentProviderIds = useCallback(
    (action: A2UI.ConfigureAgentProvidersAction) => {
      const context = action.event.context;
      return [...(providerConfigReceipts ?? [])]
        .reverse()
        .find(
          (receipt) =>
            receiptFollowsPost(receipt, post) &&
            receipt.entry.groupId === context.groupId &&
            receipt.entry.provisionId === context.provisionId
        )?.entry.providerIds;
    },
    [post, providerConfigReceipts]
  );
  const isA2UIActionConsumed = useCallback(
    (action: A2UI.Button['action']) => {
      if (action.event.name === A2UI.action.sendMessage) {
        return isA2UISendMessageActionConsumed(
          action,
          a2uiActionCompletion?.sentMessageText
        );
      }
      if (action.event.name === A2UI.action.provisionAgent) {
        return Boolean(provisionedAgentTopics);
      }
      return false;
    },
    [a2uiActionCompletion?.sentMessageText, provisionedAgentTopics]
  );
  const getConsumedA2UISelection = useCallback(
    (surfaceId: string, componentId: string) =>
      a2uiSelections.data?.find(
        (entry) =>
          entry.sourcePostId === post.id &&
          entry.surfaceId === surfaceId &&
          entry.componentId === componentId
      ),
    [a2uiSelections.data, post.id]
  );
  const lastEditPostContent = usePostLastEditContent(post);
  const blobContent = useMemo(
    () => convertContent(undefined, post.blob ?? undefined),
    [post.blob]
  );
  const hasRenderableStoryFallback = useMemo(
    () =>
      hasRenderableA2UIStoryFallback(postContent, canUseAgentProviderControls),
    [canUseAgentProviderControls, postContent]
  );
  const content = useMemo(() => {
    if (!canRenderA2UI || !hasRenderableA2UIContent) {
      return postContent.filter((block) => block.type !== 'a2ui');
    }
    // `storyMode: fallback` declares the post story as the complete textual
    // substitute for this surface. Preserve every blob-derived attachment,
    // but omit that duplicate story when the trusted A2UI can render.
    return hasRenderableStoryFallback ? blobContent : postContent;
  }, [
    blobContent,
    canRenderA2UI,
    hasRenderableStoryFallback,
    hasRenderableA2UIContent,
    postContent,
  ]);
  const lastEditContent = useMemo(() => {
    if (!canRenderA2UI || !hasRenderableA2UIContent) {
      return lastEditPostContent.filter((block) => block.type !== 'a2ui');
    }
    return hasRenderableStoryFallback ? blobContent : lastEditPostContent;
  }, [
    blobContent,
    canRenderA2UI,
    hasRenderableStoryFallback,
    hasRenderableA2UIContent,
    lastEditPostContent,
  ]);
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
            canSendA2UIResponse={Boolean(
              canRenderA2UI &&
              draftInputContext &&
              draftInputContext.canStartDraft !== false
            )}
            areA2UISelectionsPending={
              a2uiSelections.isPending || agentProtocolReceipts.isPending
            }
            a2uiSourcePostId={post.id}
            canUseAgentProviderControls={canUseAgentProviderControls}
            getConsumedA2UISelection={
              canRenderA2UI ? getConsumedA2UISelection : undefined
            }
            isA2UIActionConsumed={
              canRenderA2UI ? isA2UIActionConsumed : undefined
            }
            getConfiguredAgentProviderIds={getConfiguredAgentProviderIds}
            provisionedAgentTopics={provisionedAgentTopics}
            consumedA2UIMessageText={a2uiActionCompletion?.sentMessageText}
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

      {feedbackRow}

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
