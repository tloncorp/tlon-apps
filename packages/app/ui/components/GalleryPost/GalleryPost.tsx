import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChannelAction,
  JSONValue,
  createDevLogger,
  makePrettyDaysSince,
  makePrettyShortDate,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { parsePostBlob } from '@tloncorp/shared/logic';
import { omit } from '@tloncorp/shared/utils';
import { Button, Icon, Pressable, Text, useIsWindowNarrow } from '@tloncorp/ui';
import { differenceInDays } from 'date-fns';
import {
  ComponentProps,
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { View, XStack, styled } from 'tamagui';

import { RootStackParamList } from '../../../navigation/types';
import { getPostImageViewerId } from '../../../utils/mediaViewer';
import { useCurrentUserId } from '../../contexts/appDataContext';
import { useChannelContext } from '../../contexts/channel';
import type { MinimalRenderItemProps } from '../../contexts/componentsKits';
import { useRequests } from '../../contexts/requests';
import { useCanWrite } from '../../utils/channelUtils';
import { DetailViewAuthorRow } from '../AuthorRow';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { ReactionsDisplay } from '../ChatMessage/ReactionsDisplay';
import { ViewReactionsSheet } from '../ChatMessage/ViewReactionsSheet';
import ContactName from '../ContactName';
import { Reference } from '../ContentReference/Reference';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import { usePostContent } from '../PostContent/contentUtils';
import { PostModeration } from '../PostModeration';
import { useBoundHandler } from '../listItems/listItemUtils';
import { GalleryContentRenderer } from './GalleryContentRenderer';

const GalleryPostFrame = styled(View, {
  name: 'GalleryPostFrame',
  maxHeight: '100%',
  overflow: 'hidden',
  flex: 1,
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$m',
});

export function GalleryPost({
  post,
  onPress,
  onPressEdit,
  onLongPress,
  onPressRetry,
  showAuthor = true,
  hideOverflowMenu,
  contentRendererConfiguration,
  ...props
}: MinimalRenderItemProps &
  Omit<ComponentProps<typeof GalleryPostFrame>, 'onPress' | 'onLongPress'> & {
    hideOverflowMenu?: boolean;
  }) {
  const channel = useChannelContext();
  const currentUserId = useCurrentUserId();
  const canWrite = useCanWrite(channel, currentUserId);
  const postActionIds = useMemo(
    () => ChannelAction.channelActionIdsFor({ channel, canWrite }),
    [channel, canWrite]
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const showHeaderFooter = showAuthor && !post.hidden && !post.isDeleted;
  const hasFileUpload = useMemo(() => {
    if (!post.blob) return false;
    const blobData = parsePostBlob(post.blob);
    return blobData != null && blobData.some((x) => x.type === 'file');
  }, [post.blob]);
  const embedded = useMemo(
    () => JSONValue.asBoolean(contentRendererConfiguration?.embedded, false),
    [contentRendererConfiguration]
  );

  const size = useMemo(
    () => JSONValue.asString(contentRendererConfiguration?.contentSize, '$s'),
    [contentRendererConfiguration]
  ) as '$s' | '$l';

  const handleRetryPressed = useCallback(async () => {
    try {
      await onPressRetry?.(post);
    } catch (e) {
      console.error('Failed to retry post', e);
    }
  }, [onPressRetry, post]);

  const deliveryFailed =
    post.deliveryStatus === 'failed' ||
    post.editStatus === 'failed' ||
    post.deleteStatus === 'failed';

  const handlePress = useCallback(() => {
    onPress?.(post);
  }, [onPress, post]);

  const handleLongPress = useBoundHandler(post, onLongPress);

  const onHoverIn = useCallback(() => {
    setIsHovered(true);
  }, []);

  const onHoverOut = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleOverflowPress = useCallback(
    (e: { stopPropagation: () => void }) => {
      // Stop propagation to prevent parent onPress from firing
      e.stopPropagation();
    },
    []
  );

  const handleEditPressed = useCallback(() => {
    onPressEdit?.(post);
  }, [onPressEdit, post]);

  // we need to filter out props that are not supported by the GalleryPostFrame
  // These props come from parent components but shouldn't be passed to DOM elements
  const rest = useMemo(
    () =>
      omit(props, [
        'onShowEmojiPicker',
        'onPressImage',
        'editPost',
        'isHighlighted',
        'showReplies',
        'setViewReactionsPost',
        'onPressReplies',
        'onPressDelete',
        // @ts-expect-error - this gets passed despite not being in props
        'displayDebugMode',
      ]),
    [props]
  );

  return (
    <PostModeration post={post}>
      {(m) => {
        switch (m) {
          case 'deleted':
            return <PostModeration.Deleted flex={1} />;
          case 'blocked':
            return <PostModeration.Blocked flex={1} />;
          case 'hidden':
          // fallthrough - we don't hide gallery posts(?)
          case 'ok':
            return (
              <Pressable
                onPress={handlePress}
                onLongPress={handleLongPress}
                onHoverIn={onHoverIn}
                onHoverOut={onHoverOut}
                flex={1}
                testID="Post"
              >
                <GalleryPostFrame {...rest}>
                  {showHeaderFooter && <GalleryPostHeader post={post} />}
                  {hasFileUpload && (
                    <GalleryPostRow>
                      <XStack alignItems="center" gap="$xs">
                        <Icon
                          type="ChannelNote"
                          color="$tertiaryText"
                          customSize={['$l', '$l']}
                        />
                        <GalleryPostRow.Text>File upload</GalleryPostRow.Text>
                      </XStack>
                      <Reference.ActionIcon />
                    </GalleryPostRow>
                  )}
                  <GalleryContentRenderer
                    testID="GalleryPostContentPreview"
                    post={post}
                    pointerEvents="none"
                    size={size}
                    embedded={embedded}
                    isPreview={true}
                  />
                  {showHeaderFooter && (
                    <GalleryPostFooter
                      post={post}
                      deliveryFailed={deliveryFailed}
                      onPressRetry={handleRetryPressed}
                    />
                  )}
                  {!hideOverflowMenu && (isPopoverOpen || isHovered) && (
                    <Pressable
                      position="absolute"
                      top={36}
                      right={4}
                      onPress={handleOverflowPress}
                    >
                      <ChatMessageActions
                        post={post}
                        postActionIds={postActionIds}
                        onDismiss={() => {
                          setIsPopoverOpen(false);
                          setIsHovered(false);
                        }}
                        onOpenChange={setIsPopoverOpen}
                        onReply={handlePress}
                        onEdit={handleEditPressed}
                        mode="await-trigger"
                        trigger={
                          <Button
                            icon="Overflow"
                            fill="ghost"
                            type="secondary"
                            size="small"
                            width={32}
                            height={32}
                            borderRadius="$m"
                            testID="MessageActionsTrigger"
                          />
                        }
                      />
                    </Pressable>
                  )}
                </GalleryPostFrame>
              </Pressable>
            );
        }
      }}
    </PostModeration>
  );
}

function GalleryPostRow({ children }: PropsWithChildren) {
  return (
    <View width="100%" pointerEvents="none">
      <XStack
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="$background"
        borderBottomWidth={1}
        borderColor="$border"
        borderTopWidth={0}
        padding="$l"
        gap="$m"
      >
        {children}
      </XStack>
    </View>
  );
}
GalleryPostRow.Text = styled(Text, {
  size: '$label/m',
  color: '$tertiaryText',
});

export function GalleryPostHeader({ post }: { post: db.Post }) {
  return (
    <GalleryPostRow>
      <ContactName
        userId={post.authorId}
        showNickname
        size="$label/m"
        color="$tertiaryText"
      />
      <GalleryPostRow.Text>
        {differenceInDays(new Date(), new Date(post.receivedAt)) > 30
          ? makePrettyShortDate(new Date(post.receivedAt))
          : makePrettyDaysSince(new Date(post.receivedAt))}
      </GalleryPostRow.Text>
    </GalleryPostRow>
  );
}

export function GalleryPostFooter({
  post,
  deliveryFailed,
  onPressRetry,
  ...props
}: {
  post: db.Post;
  deliveryFailed?: boolean;
  onPressRetry?: () => void;
} & ComponentProps<typeof XStack>) {
  const isWindowNarrow = useIsWindowNarrow();
  const retryVerb = useMemo(() => {
    if (isWindowNarrow) {
      return 'Tap';
    } else {
      return 'Click';
    }
  }, [isWindowNarrow]);

  return (
    <View width="100%" pointerEvents="box-none">
      <XStack
        pointerEvents="box-none"
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="$background"
        borderTopWidth={1}
        borderColor="$border"
        gap="$xl"
        height="$3.5xl"
        padding="$m"
        {...props}
      >
        <View pointerEvents="auto">
          <ReactionsDisplay post={post} minimal={true} />
        </View>
        {deliveryFailed ? (
          <Pressable pointerEvents="auto" onPress={onPressRetry}>
            <Text color="$negativeActionText" size="$label/s">
              {retryVerb} to retry
            </Text>
          </Pressable>
        ) : (
          <XStack alignItems="center" gap="$xs" justifyContent="center">
            <Text size="$label/m" color="$tertiaryText">
              {post.replyCount}
            </Text>
            <Icon color="$tertiaryText" size="$s" type="Messages" />
          </XStack>
        )}
      </XStack>
    </View>
  );
}

export function GalleryPostDetailView({
  post,
  onPressImage,
}: {
  post: db.Post;
  onPressImage?: (post: db.Post, uri?: string) => void;
}) {
  const { usePost } = useRequests();
  // we use usePost so we can get updated reactions
  // and reply count
  const { data: livePost } = usePost({ id: post.id });
  const logger = createDevLogger('GalleryPostDetailView', true);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const content = usePostContent(post);
  const [viewReactionsOpen, setViewReactionsOpen] = useState(false);

  const firstImage = useMemo(() => {
    const img = content.find((block) => block.type === 'image');
    return img;
  }, [content]);

  const isImagePost = useMemo(() => !!firstImage, [firstImage]);
  const isTextPost = useMemo(() => {
    const type = content[0]?.type;
    return !['video', 'image', 'link', 'reference'].includes(type);
  }, [content]);

  const handlePressImage = useCallback(
    (src: string) => {
      logger.log('Detail view: Image pressed, navigating to', src);
      try {
        navigation.navigate('MediaViewer', {
          mediaType: 'image',
          uri: src,
          viewerId: getPostImageViewerId(post.id, src),
        });
      } catch (error) {
        logger.log('Navigation error:', error);
        // Try the fallback if direct navigation fails
        if (onPressImage && firstImage && firstImage.type === 'image') {
          onPressImage(post, firstImage.src);
        }
      }
    },
    [navigation, logger, onPressImage, post, firstImage]
  );

  const handleViewPostReactions = useCallback(() => {
    setViewReactionsOpen(true);
  }, []);

  // we need to remove the image from the content for the caption
  // if we don't, it gets filtered out in the renderer
  // and we end up with a blank space
  const contentWithoutImage = useMemo(() => {
    return content.filter((block) => block.type !== 'image');
  }, [content]);

  return (
    <View paddingBottom="$xs" borderBottomWidth={1} borderColor="$border">
      <View
        // For some reason minHeight ternary isn't working unless we disable optimization here
        disableOptimization
        {...(isTextPost
          ? {
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: '$border',
              backgroundColor: '$secondaryBackground',
            }
          : {})}
        minHeight={isImagePost ? 100 : 300}
      >
        <GalleryContentRenderer
          embedded
          post={post}
          size="$l"
          onPressImage={handlePressImage}
          getImageViewerId={(src) => getPostImageViewerId(post.id, src)}
          testID="GalleryPostContent"
          isPreview={false}
        />
      </View>

      <View gap="$2xl" padding="$xl">
        <DetailViewAuthorRow
          authorId={post.authorId}
          isBot={post.isBot ?? undefined}
          sent={post.sentAt}
          color="$primaryText"
          showSentAt={true}
        />

        {post.title ? <Text size="$body">{post.title}</Text> : null}

        {isImagePost && (
          <CaptionContentRenderer content={contentWithoutImage} />
        )}

        <XStack justifyContent="space-between" alignItems="center">
          <ReactionsDisplay
            post={livePost ?? post}
            minimal={false}
            onViewPostReactions={handleViewPostReactions}
          />
          <Text size="$label/m" color="$secondaryText">
            {livePost && livePost.replyCount && livePost.replyCount > 0
              ? livePost.replyCount === 1
                ? `${livePost.replyCount} comment`
                : `${livePost.replyCount} comments`
              : 'No comments'}
          </Text>
        </XStack>
      </View>

      <ViewReactionsSheet
        post={post}
        open={viewReactionsOpen}
        onOpenChange={setViewReactionsOpen}
      />
    </View>
  );
}

const CaptionContentRenderer = createContentRenderer({
  blockSettings: {
    paragraph: {
      size: '$body',
      wrapperProps: {
        padding: 0,
      },
    },
    image: {
      display: 'none',
    },
  },
});
