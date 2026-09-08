import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { isEqual } from 'lodash';
import React, {
  ComponentPropsWithoutRef,
  PropsWithChildren,
  RefObject,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { LayoutChangeEvent, View as RNView } from 'react-native';
import { View, styled } from 'tamagui';

import { useLivePost } from '../../../hooks/useLivePost';
import type {
  A2UIActionCompletion,
  RenderItemType,
} from '../../contexts/componentsKits';
import { ConversationListDiagnosticsContext } from './PostList/diagnostics';
import {
  NativeReadListContext,
  NativeReadRowContext,
} from '../../contexts/nativeRead';
import { ChannelDivider } from './ChannelDivider';
import type { PostTargetLayoutRegistry } from './postTargetLayout';
import { usePostTargetLayout } from './usePostTargetLayout';

// Create empty post object to avoid recreating it on every render
const EMPTY_POST: db.Post = {
  id: '',
  authorId: '',
  channelId: '',
  type: 'chat',
  receivedAt: 0,
  sentAt: 0,
  isDeleted: false,
  replyCount: 0,
};

const BaseScrollerItem = ({
  item,
  index,
  showUnreadDivider,
  showDayDivider,
  showAuthor,
  Component,
  unreadCount,
  onLayout,
  setViewReactionsPost,
  onPressBotRun,
  showReplies,
  onPressImage,
  onPressReplies,
  onPressPost,
  onLongPressPost,
  onPressRetry,
  onPressDelete,
  onShowEmojiPicker,
  onPressEdit,
  activeMessage,
  messageRef,
  isSelected,
  displayDebugMode,
  isLastPostOfBlock,
  dividersEnabled,
  itemAspectRatio,
  itemWidth,
  columnCount,
  previousPost,
  a2uiActionCompletion,
  targetLayouts,
}: {
  targetLayouts?: PostTargetLayoutRegistry;
  showUnreadDivider: boolean;
  showAuthor: boolean;
  showDayDivider: boolean;
  item: db.Post;
  index: number;
  Component: RenderItemType;
  unreadCount?: number | null;
  onLayout?: (post: db.Post, index: number, e: LayoutChangeEvent) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  showReplies?: boolean;
  setViewReactionsPost?: (post: db.Post) => void;
  onPressBotRun?: (post: db.Post) => void;
  onPressPost?: (post: db.Post) => void;
  onLongPressPost: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  onShowEmojiPicker: (post: db.Post) => void;
  onPressEdit?: (post: db.Post) => void;
  activeMessage?: db.Post | null;
  messageRef: RefObject<RNView | null>;
  isSelected: boolean;
  displayDebugMode?: boolean;
  isLastPostOfBlock: boolean;
  dividersEnabled: boolean;
  itemAspectRatio?: number;
  itemWidth?: number;
  columnCount: number;
  previousPost?: db.Post | null;
  a2uiActionCompletion?: A2UIActionCompletion;
}) => {
  const post = useLivePost(item);
  const nativeReadList = useContext(NativeReadListContext);
  const nativeReadRow = useMemo(() => {
    if (!nativeReadList?.membership.valid) return null;
    const identity = nativeReadList.membership.rows.find(
      (row) => row.key === post.id
    );
    return identity ? { ...nativeReadList.binding, ...identity } : null;
  }, [nativeReadList, post.id]);
  const ruler = useContext(ConversationListDiagnosticsContext)?.ruler;

  // A live deletion of the previous message starts a new author block.
  const livePreviousPost = useLivePost(previousPost ?? EMPTY_POST);
  const showAuthorLive =
    showAuthor ||
    (Boolean(previousPost) && livePreviousPost.isDeleted === true);
  const hasUnreadDivider = dividersEnabled && showUnreadDivider;
  const hasDivider = dividersEnabled && (showUnreadDivider || showDayDivider);

  const targetLayout = usePostTargetLayout({
    registry: targetLayouts,
    scope: post.channelId ?? '',
    rowKey: post.id,
    leading: hasDivider,
    trailing: isLastPostOfBlock,
  });
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      targetLayout?.refresh();
      onLayout?.(post, index, event);
    },
    [targetLayout, onLayout, post, index]
  );

  const divider = useMemo(() => {
    if (!hasDivider) return null;
    return (
      <>
        <ChannelDivider
          post={post}
          measurementRef={targetLayout?.divider.ref}
          onLayout={targetLayout?.divider.onLayout}
          unreadCount={hasUnreadDivider ? (unreadCount ?? 0) : 0}
          isFirstPostOfDay={hasUnreadDivider ? showDayDivider : undefined}
        />
        <PostBlockSeparator {...targetLayout?.leadingSeparator} />
      </>
    );
  }, [
    hasDivider,
    hasUnreadDivider,
    post,
    unreadCount,
    showDayDivider,
    targetLayout,
  ]);

  const editPost = useCallback<
    Exclude<ComponentPropsWithoutRef<RenderItemType>['editPost'], undefined>
  >(async (post, content) => {
    await store.editPost({
      post,
      content,
    });
  }, []);

  return (
    <View
      {...(ruler
        ? {
            testID: `scroll-cell-${post.id}`,
            collapsable: false,
            accessibilityValue: {
              text: JSON.stringify({ version: 1, ...ruler.rowMetadata(post) }),
            },
          }
        : {})}
      ref={targetLayout?.cell.ref}
      onLayout={handleLayout}
      width={columnCount === 1 ? '100%' : itemWidth}
      aspectRatio={itemAspectRatio}
    >
      {divider}
      <PressableMessage
        ref={messageRef}
        isActive={activeMessage?.id === post.id}
      >
        <NativeReadRowContext.Provider value={nativeReadRow}>
          <Component
            editPost={editPost}
            isHighlighted={isSelected}
            displayDebugMode={displayDebugMode}
            post={post}
            a2uiActionCompletion={a2uiActionCompletion}
            setViewReactionsPost={setViewReactionsPost}
            onPressBotRun={onPressBotRun}
            showAuthor={showAuthorLive}
            showReplies={showReplies}
            onPressReplies={post.isDeleted ? undefined : onPressReplies}
            onPressImage={post.isDeleted ? undefined : onPressImage}
            onLongPress={post.isDeleted ? undefined : onLongPressPost}
            onPress={post.isDeleted ? undefined : onPressPost}
            onPressRetry={onPressRetry}
            onPressDelete={onPressDelete}
            onShowEmojiPicker={onShowEmojiPicker}
            onPressEdit={onPressEdit}
          />
        </NativeReadRowContext.Provider>
      </PressableMessage>
      {isLastPostOfBlock && (
        <PostBlockSeparator {...targetLayout?.trailingSeparator} />
      )}
    </View>
  );
};

export const PostBlockSeparator = styled(View, {
  name: 'PostBlockSeparator',
  height: '$m',
  width: '100%',
});

export const ScrollerItem = React.memo(BaseScrollerItem, (previous, next) => {
  // Query refreshes can replace an unchanged post object. Keep that useful
  // bailout, but never omit a renderer, action, ref or layout prop.
  const keys = Object.keys({ ...previous, ...next }) as (keyof typeof next)[];
  return keys.every((key) =>
    key === 'item'
      ? isEqual(previous.item, next.item)
      : Object.is(previous[key], next[key])
  );
});

const PressableMessage = React.memo(
  forwardRef<RNView, PropsWithChildren<{ isActive: boolean }>>(
    function PressableMessageComponent({ isActive, children }, ref) {
      return isActive ? (
        // need the extra React Native View for ref measurement
        <RNView ref={ref}>{children}</RNView>
      ) : (
        // this fragment is necessary to avoid the TS error about not being able to
        // return undefined
        <>{children}</>
      );
    }
  )
);
