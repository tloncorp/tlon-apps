import {
  PostCollectionLayoutType,
  configurationFromChannel,
  layoutForType,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { isSameDay } from '@tloncorp/shared/logic';
import {
  Button,
  Text,
  LoadingSpinner,
  Modal,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import React, {
  ReactElement,
  RefObject,
  createRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ListRenderItem, Platform, View as RNView } from 'react-native';
import { View, useTheme } from 'tamagui';

import { useLifecyclePermit } from '../../../hooks/useLifecyclePermit';
import { useCurrentUserId } from '../../contexts/appDataContext';
import type { RenderItemType } from '../../contexts/componentsKits';
import { useSetConversationScrollToBottomControl } from '../../contexts/scroll';
import useOnEmojiSelect from '../../hooks/useOnEmojiSelect';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { ViewReactionsSheet } from '../ChatMessage/ViewReactionsSheet';
import { getA2UIActionCompletions } from '../ChatMessage/a2uiActionCompletion';
import { EmojiPickerSheet } from '../Emoji';
import { supportsLiquidGlass } from '../GlassSurface';
import { ConversationScrollToBottomButton } from '../conversationScrollChrome';
import { ContextLensRunSheet } from './ContextLens/ContextLensRunSheet';
import {
  ConversationContentInsets,
  PostList,
  PostListMethods,
  PostWithNeighbors,
} from './PostList';
import {
  getPostListAnchorKey,
  getPostListScopeKey,
} from './PostList/postListInitialization';
import { ScrollerItem } from './ScrollerItem';
import { createPostTargetLayoutRegistry } from './postTargetLayout';
import { useScrollerReadiness } from './useScrollerReadiness';
import { useScrollerLatest } from './useScrollerLatest';
import { useScrollerLayout } from './useScrollerLayout';
import { isVisibleChannelPost } from './postVisibility';
import type { ScrollAnchor } from './scrollerTypes';

export type { ScrollAnchor } from './scrollerTypes';

export type ScrollerProps = {
  /** Route focus combined with the active carousel item, when applicable. */
  isFocused?: boolean;
  anchor?: ScrollAnchor | null;
  showDividers?: boolean;
  anchorToEnd: boolean;
  renderItem: RenderItemType;
  renderEmptyComponent?: () => ReactElement;
  posts: db.Post[] | null;
  channel: db.Channel;
  collectionLayoutType: PostCollectionLayoutType;
  firstUnreadId?: string | null;
  unreadCount?: number | null;
  onStartReached?: () => void;
  onEndReached?: () => void;
  onPressPost?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  showReplies?: boolean;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  hasNewerPosts?: boolean;
  activeMessage: db.Post | null;
  setActiveMessage: (post: db.Post | null) => void;
  isLoading?: boolean;
  // Unused
  hasOlderPosts?: boolean;
  onPressScrollToBottom?: () => void;
  listHeaderComponent?: React.ReactElement;
  listBottomComponent?: React.ReactElement;
  highlightPostId?: string | null;
  onGoToBotRun?: (params: { botShip: string; lensId: string }) => void;
  onOpenContextLens?: (post: db.Post) => void;
  contextLensSelectedPostId?: string | null;
  contentInsets?: ConversationContentInsets;
};

/**
 * This scroller makes some assumptions you should not break!
 * - Posts and unread state should be be loaded before the scroller is rendered
 * - Posts should be supplied in their visual top-to-bottom order
 * - If we're scrolling to an anchor, that anchor should be in the first page of posts
 */
const Scroller = forwardRef<PostListMethods, ScrollerProps>(
  (
    {
      isFocused = true,
      anchor,
      showDividers = true,
      anchorToEnd,
      renderItem,
      renderEmptyComponent,
      posts,
      channel,
      collectionLayoutType,
      firstUnreadId,
      unreadCount,
      onStartReached,
      onEndReached,
      onPressPost,
      onPressImage,
      onPressReplies,
      showReplies = true,
      editingPost,
      setEditingPost,
      onPressRetry,
      onPressDelete,
      hasNewerPosts,
      activeMessage,
      setActiveMessage,
      isLoading,
      onPressScrollToBottom,
      listHeaderComponent,
      listBottomComponent,
      highlightPostId,
      onGoToBotRun,
      onOpenContextLens,
      contextLensSelectedPostId,
      contentInsets = { top: 0, bottom: 0 },
    }: ScrollerProps,
    ref
  ) => {
    const collectionLayout = useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    const currentUserId = useCurrentUserId();
    const collectionConfig = useMemo(
      () => configurationFromChannel(channel),
      [channel]
    );
    const isWindowNarrow = useIsWindowNarrow();
    const setScrollToBottomControl = useSetConversationScrollToBottomControl();
    const [viewReactionsPost, setViewReactionsPost] = useState<null | db.Post>(
      null
    );
    const [viewBotRunPost, setViewBotRunPost] = useState<null | db.Post>(null);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

    const handlePressBotRun = useCallback(
      (post: db.Post) => {
        if (onOpenContextLens) {
          onOpenContextLens(post);
          return;
        }
        setViewBotRunPost(post);
      },
      [onOpenContextLens]
    );

    const listRef = useRef<PostListMethods>(null);
    const targetLayouts = useMemo(
      () =>
        Platform.OS === 'ios' &&
        anchorToEnd &&
        collectionLayoutType === 'compact-list-bottom-to-top'
          ? createPostTargetLayoutRegistry(channel.id)
          : undefined,
      [channel.id, collectionLayoutType, anchorToEnd]
    );
    // Route cover retires movement authority without replacing list readiness,
    // mounted content, or the draft. Own cursor retirement keeps this visit.
    const scrollVisit = useLifecyclePermit(
      [channel.id, collectionLayoutType, anchorToEnd, isFocused],
      isFocused
    );

    useImperativeHandle(ref, () => ({
      captureScrollIntent: () => {
        const entry = readiness.entry;
        const surface = listRef.current;
        const permit = surface?.captureScrollIntent?.() ?? (() => true);
        const stillVisiting = scrollVisit.capture();
        return () =>
          surface !== null && entry.active && stillVisiting() && permit();
      },
      scrollToPost: (params: {
        postId: string;
        animated?: boolean;
        viewPosition?: number;
      }) => {
        if (scrollVisit.isCurrent() && readiness.entry.active)
          listRef.current?.scrollToPost(params);
      },
      scrollToStart: (params: { animated?: boolean }) => {
        if (scrollVisit.isCurrent() && readiness.entry.active)
          listRef.current?.scrollToStart(params);
      },
      scrollToEnd: (params: { animated?: boolean }) => {
        if (scrollVisit.isCurrent() && readiness.entry.active)
          listRef.current?.scrollToEnd(params);
      },
    }));

    const activeMessageRefs = useRef<Record<string, RefObject<RNView | null>>>(
      {}
    );

    const handleSetActive = useCallback(
      (active: db.Post) => {
        if (active.type !== 'notice') {
          activeMessageRefs.current = { [active.id]: createRef() };
          setActiveMessage(active);
        }
      },
      [setActiveMessage]
    );

    const handleShowEmojiPicker = useCallback(
      (post: db.Post) => {
        setActiveMessage(post);
        setEmojiPickerOpen(true);
      },
      [setActiveMessage]
    );

    const handlePressEdit = useCallback(
      (post: db.Post) => {
        setEditingPost?.(post);
        setActiveMessage(null);
      },
      [setActiveMessage, setEditingPost]
    );

    const handlePostLongPressed = useCallback(
      (post: db.Post) => {
        handleSetActive(post);
      },
      [handleSetActive]
    );

    const { value: debugMessageJson } = db.debugMessageJson.useStorageItem();

    const theme = useTheme();

    const visiblePosts = useMemo(
      () =>
        posts?.filter((post) =>
          isVisibleChannelPost(post, currentUserId, channel.id)
        ),
      [channel.id, currentUserId, posts]
    );

    const postsWithNeighbors: PostWithNeighbors[] | undefined = useMemo(
      () =>
        visiblePosts?.map((post, postIndex, posts) => {
          return {
            post,
            previous: postIndex > 0 ? posts[postIndex - 1] : null,
            next: postIndex + 1 < posts.length ? posts[postIndex + 1] : null,
          };
        }),
      [visiblePosts]
    );
    const a2uiActionCompletions = useMemo(
      () =>
        getA2UIActionCompletions(
          visiblePosts ?? [],
          currentUserId,
          !anchorToEnd
        ),
      [anchorToEnd, currentUserId, visiblePosts]
    );

    const style = useMemo(() => {
      return {
        backgroundColor: theme.background.val,
      };
    }, [theme.background.val]);

    const {
      columns,
      itemWidth,
      contentContainerStyle,
      columnWrapperStyle,
      composerBottomInset,
      scrollButtonBottom,
      listOwnsComposerInset,
      handleListFrameLayout,
    } = useScrollerLayout({
      collectionLayoutType,
      collectionLayout,
      visiblePostCount: visiblePosts?.length ?? 0,
      contentInsets,
      isWindowNarrow,
    });

    const listRenderItem: ListRenderItem<PostWithNeighbors> = useCallback(
      ({ item: { post, previous, next, ...rest }, index }) => {
        const isFirstPostOfDay = !isSameDay(
          post.receivedAt ?? 0,
          previous?.receivedAt ?? 0
        );
        const isLastPostOfBlock =
          post.type !== 'notice' &&
          (post.type === 'chat' || post.type === 'reply') &&
          next != null &&
          (next.authorId !== post.authorId ||
            !isSameDay(post.receivedAt ?? 0, next.receivedAt ?? 0));
        const showAuthor =
          post.type === 'note' ||
          post.type === 'block' ||
          !previous ||
          previous?.authorId !== post.authorId ||
          previous?.type === 'notice' ||
          previous?.isDeleted === true ||
          isFirstPostOfDay;
        const isFirstUnread = post.id === firstUnreadId;
        const isSelected =
          (anchor?.type === 'selected' && anchor.postId === post.id) ||
          highlightPostId === post.id ||
          contextLensSelectedPostId === post.id;
        const a2uiActionCompletion = a2uiActionCompletions[index];

        return (
          <ScrollerItem
            item={post}
            targetLayouts={targetLayouts}
            index={index}
            isSelected={isSelected}
            showUnreadDivider={showDividers && isFirstUnread}
            showDayDivider={showDividers && isFirstPostOfDay}
            showAuthor={showAuthor}
            isLastPostOfBlock={isLastPostOfBlock}
            displayDebugMode={debugMessageJson}
            Component={renderItem}
            unreadCount={unreadCount}
            setViewReactionsPost={setViewReactionsPost}
            onPressBotRun={handlePressBotRun}
            onPressRetry={onPressRetry}
            onPressDelete={onPressDelete}
            showReplies={showReplies}
            onPressImage={onPressImage}
            onPressReplies={onPressReplies}
            onPressPost={onPressPost}
            onLongPressPost={handlePostLongPressed}
            onShowEmojiPicker={handleShowEmojiPicker}
            onPressEdit={handlePressEdit}
            activeMessage={activeMessage}
            messageRef={activeMessageRefs.current[post.id]}
            dividersEnabled={collectionLayout.dividersEnabled}
            itemAspectRatio={collectionLayout.itemAspectRatio ?? undefined}
            itemWidth={itemWidth}
            columnCount={columns}
            previousPost={previous}
            a2uiActionCompletion={a2uiActionCompletion}
            {...rest}
          />
        );
      },
      [
        anchor?.type,
        anchor?.postId,
        highlightPostId,
        contextLensSelectedPostId,
        firstUnreadId,
        targetLayouts,
        renderItem,
        unreadCount,
        showReplies,
        onPressImage,
        onPressReplies,
        onPressPost,
        onPressDelete,
        onPressRetry,
        handlePostLongPressed,
        handlePressBotRun,
        handleShowEmojiPicker,
        handlePressEdit,
        activeMessage,
        showDividers,
        collectionLayout.dividersEnabled,
        collectionLayout.itemAspectRatio,
        columns,
        itemWidth,
        a2uiActionCompletions,
        setActiveMessage,
        setEditingPost,
        debugMessageJson,
      ]
    );

    const readiness = useScrollerReadiness({
      scopeKey: getPostListScopeKey(channel.id, anchor),
      onStartReached,
      onEndReached,
    });
    const readyToDisplayPosts = readiness.isReady;
    const latest = useScrollerLatest({
      scrollVisit,
      conversationKey: `${channel.id}:${collectionLayoutType}:${anchorToEnd}`,
      entry: readiness.entry,
      anchorKey: getPostListAnchorKey(anchor),
      isReady: readyToDisplayPosts,
      isLoading: Boolean(isLoading),
      hasNewerPosts: Boolean(hasNewerPosts),
      listRef,
      onPressScrollToBottom,
    });
    const showScrollButton =
      isFocused &&
      readyToDisplayPosts &&
      collectionLayoutType === 'compact-list-bottom-to-top' &&
      anchorToEnd &&
      !latest.atBottom;

    const onEmojiSelect = useOnEmojiSelect(activeMessage, () =>
      setEmojiPickerOpen(false)
    );

    const hostsScrollButtonInComposer =
      supportsLiquidGlass() && composerBottomInset > 0;

    useLayoutEffect(() => {
      setScrollToBottomControl(
        hostsScrollButtonInComposer
          ? {
              isLoading: latest.loading,
              onPress: latest.onPress,
              visible: showScrollButton,
            }
          : null
      );
    }, [
      latest.loading,
      hostsScrollButtonInComposer,
      isLoading,
      latest.onPress,
      setScrollToBottomControl,
      showScrollButton,
    ]);

    useEffect(
      () => () => {
        setScrollToBottomControl(null);
      },
      [setScrollToBottomControl]
    );

    return (
      <View
        flex={1}
        onLayout={listOwnsComposerInset ? handleListFrameLayout : undefined}
      >
        {postsWithNeighbors != null && (
          <PostList
            isFocused={isFocused}
            targetLayouts={targetLayouts}
            scrollVisit={scrollVisit}
            anchor={anchor}
            channel={channel}
            collectionLayoutType={collectionLayoutType}
            columnWrapperStyle={columnWrapperStyle}
            contentContainerStyle={contentContainerStyle}
            hasNewerPosts={hasNewerPosts}
            isLoading={isLoading}
            anchorToEnd={anchorToEnd}
            // This is needed so that we can force a refresh of the list when
            // we need to switch from 1 to 2 columns or vice versa.
            key={channel.type + '-' + columns}
            numColumns={columns}
            onEndReached={readiness.onEndReached}
            onEndReachedThreshold={1}
            onInitialScrollPending={readiness.onInitialScrollPending}
            onInitialScrollCompleted={readiness.onInitialScrollCompleted}
            onInitialScrollRecoveryChange={
              readiness.onInitialScrollRecoveryChange
            }
            onScrollIntentChanged={latest.cancel}
            onScrolledAwayFromBottom={latest.onScrolledAwayFromBottom}
            onScrolledToBottom={latest.onScrolledToBottom}
            onScrolledToBottomThreshold={1}
            onStartReached={readiness.onStartReached}
            onStartReachedThreshold={1}
            postsWithNeighbors={postsWithNeighbors}
            ref={listRef}
            renderEmptyComponent={renderEmptyComponent}
            renderItem={listRenderItem}
            // Disabled to prevent the user from accidentally blurring the edit
            // input while they're typing.
            scrollEnabled={!editingPost}
            style={style}
            listHeaderComponent={listHeaderComponent}
            listBottomComponent={listBottomComponent}
            contentInsets={contentInsets}
          />
        )}
        {postsWithNeighbors != null &&
          postsWithNeighbors.length > 0 &&
          !readyToDisplayPosts && (
            <View
              position="absolute"
              inset={0}
              alignItems="center"
              justifyContent="center"
              pointerEvents="auto"
            >
              {readiness.recovery ? (
                <View
                  gap="$l"
                  alignItems="center"
                  padding="$l"
                  testID="InitialScrollRecovery"
                >
                  <Text color="$secondaryText">
                    Could not open this conversation.
                  </Text>
                  <Button
                    preset="secondary"
                    label="Try again"
                    centered
                    onPress={readiness.recovery.retry}
                  />
                </View>
              ) : (
                <LoadingSpinner size="small" />
              )}
            </View>
          )}
        {!hostsScrollButtonInComposer && (
          <View
            position="absolute"
            bottom={scrollButtonBottom}
            left={Platform.OS === 'web' ? undefined : 0}
            right={Platform.OS === 'web' ? '$l' : 0}
            alignItems={Platform.OS === 'web' ? undefined : 'center'}
            pointerEvents={showScrollButton ? 'box-none' : 'none'}
            zIndex={1000}
          >
            <ConversationScrollToBottomButton
              loading={latest.loading}
              onPress={latest.onPress}
              visible={showScrollButton}
            />
          </View>
        )}
        {activeMessage !== null && !emojiPickerOpen && (
          <Modal
            visible={activeMessage !== null && !emojiPickerOpen}
            onDismiss={
              isWindowNarrow ? () => setActiveMessage(null) : undefined
            }
            // We don't pass an onDismiss function on desktop because
            // a) the modal is dismissed by the actions in the
            // ChatMessageActions component.
            // b) Including it here will cause the modal to close before the
            // EmojiPickerSheet can open when the user clicks the caretdown in
            // the EmojiToolbar.
          >
            <ChatMessageActions
              post={activeMessage}
              postActionIds={collectionConfig.postActionIds}
              postRef={activeMessageRefs.current[activeMessage!.id]}
              onDismiss={() => setActiveMessage(null)}
              onReply={onPressReplies}
              onEdit={() => {
                setEditingPost?.(activeMessage);
                setActiveMessage(null);
              }}
              onShowEmojiPicker={() => {
                setEmojiPickerOpen(true);
              }}
              onViewReactions={(post) => {
                setViewReactionsPost(post);
                setActiveMessage(null);
              }}
              onViewBotRun={(post) => {
                setActiveMessage(null);
                if (onOpenContextLens) {
                  onOpenContextLens(post);
                  return;
                }
                setViewBotRunPost(post);
              }}
              mode="immediate"
            />
          </Modal>
        )}
        {emojiPickerOpen && activeMessage ? (
          <EmojiPickerSheet
            open
            onOpenChange={() => {
              setActiveMessage(null);
              setEmojiPickerOpen(false);
            }}
            onEmojiSelect={onEmojiSelect}
          />
        ) : null}
        {viewReactionsPost ? (
          <ViewReactionsSheet
            post={viewReactionsPost}
            open
            onOpenChange={() => setViewReactionsPost(null)}
          />
        ) : null}
        {viewBotRunPost ? (
          <ContextLensRunSheet
            post={viewBotRunPost}
            open
            onOpenChange={() => setViewBotRunPost(null)}
            onExpand={onGoToBotRun}
          />
        ) : null}
      </View>
    );
  }
);

Scroller.displayName = 'Scroller';

export default React.memo(Scroller);

export { PostBlockSeparator } from './ScrollerItem';
