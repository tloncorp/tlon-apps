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
import {
  BlockData,
  BlockFromType,
  BlockType,
  PostContent,
} from '@tloncorp/shared/logic';
import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { differenceInDays } from 'date-fns';
import { now, truncate } from 'lodash';
import {
  ComponentProps,
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { View, XStack, styled } from 'tamagui';

import { RootStackParamList } from '../../../navigation/types';
import { useChannelContext, useCurrentUserId, useRequests } from '../../contexts';
import { useCanWrite } from '../../utils/channelUtils';
import { MinimalRenderItemProps } from '../../contexts/componentsKits';
import { DetailViewAuthorRow } from '../AuthorRow';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { ReactionsDisplay } from '../ChatMessage/ReactionsDisplay';
import { ViewReactionsSheet } from '../ChatMessage/ViewReactionsSheet';
import ContactName from '../ContactName';
import { useBoundHandler } from '../ListItem/listItemUtils';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import { usePostContent } from '../PostContent/contentUtils';
import { SendPostRetrySheet } from '../SendPostRetrySheet';

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
  onPressDelete,
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
  const [showRetrySheet, setShowRetrySheet] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const showHeaderFooter = showAuthor && !post.hidden && !post.isDeleted;
  const embedded = useMemo(
    () => JSONValue.asBoolean(contentRendererConfiguration?.embedded, false),
    [contentRendererConfiguration]
  );

  const size = useMemo(
    () => JSONValue.asString(contentRendererConfiguration?.contentSize, '$s'),
    [contentRendererConfiguration]
  ) as '$s' | '$l';

  const handleRetryPressed = useCallback(() => {
    onPressRetry?.(post);
    setShowRetrySheet(false);
  }, [onPressRetry, post]);

  const handleDeletePressed = useCallback(() => {
    onPressDelete?.(post);
    setShowRetrySheet(false);
  }, [onPressDelete, post]);

  const deliveryFailed =
    post.deliveryStatus === 'failed' ||
    post.editStatus === 'failed' ||
    post.deleteStatus === 'failed';

  const handlePress = useCallback(() => {
    if (onPress && !deliveryFailed) {
      onPress(post);
    } else if (deliveryFailed) {
      setShowRetrySheet(true);
    }
  }, [onPress, deliveryFailed, post]);

  const handleLongPress = useBoundHandler(post, onLongPress);

  const onHoverIn = useCallback(() => {
    setIsHovered(true);
  }, []);

  const onHoverOut = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleOverflowPress = useCallback((e: any) => {
    // Stop propagation to prevent parent onPress from firing
    e.stopPropagation();
  }, []);

  if (post.isDeleted) {
    return null;
  }

  // we need to filter out props that are not supported by the GalleryPostFrame
  const {
    onShowEmojiPicker: _onShowEmojiPicker,
    onPressImage: _onPressImage,
    editPost: _editPost,
    isHighlighted: _isHighlighted,
    showReplies: _showReplies,
    setViewReactionsPost: _setViewReactionsPost,
    onPressReplies: _onPressReplies,
    ...rest
  } = props;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      flex={1}
      testID="Post"
    >
      <GalleryPostFrame {...props}>
        {showHeaderFooter && <GalleryPostHeader post={post} />}
        <GalleryContentRenderer
          testID="GalleryPostContentPreview"
          post={post}
          pointerEvents="none"
          size={size}
          embedded={embedded}
        />
        {showHeaderFooter && (
          <GalleryPostFooter post={post} deliveryFailed={deliveryFailed} />
        )}
        <SendPostRetrySheet
          open={showRetrySheet}
          onOpenChange={setShowRetrySheet}
          post={post}
          onPressDelete={handleDeletePressed}
          onPressRetry={handleRetryPressed}
        />
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
              onEdit={onPressEdit}
              mode="await-trigger"
              trigger={
                <Button
                  borderWidth="unset"
                  size="$xs"
                  onPress={handleOverflowPress}
                  testID="MessageActionsTrigger"
                >
                  <Icon type="Overflow" />
                </Button>
              }
            />
          </Pressable>
        )}
      </GalleryPostFrame>
    </Pressable>
  );
}

export function GalleryPostHeader({ post }: { post: db.Post }) {
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
        <ContactName
          userId={post.authorId}
          showNickname
          size="$label/m"
          color="$tertiaryText"
        />
        <Text size="$label/m" color="$tertiaryText">
          {differenceInDays(new Date(), new Date(post.receivedAt)) > 30
            ? makePrettyShortDate(new Date(post.receivedAt))
            : makePrettyDaysSince(new Date(post.receivedAt))}
        </Text>
      </XStack>
    </View>
  );
}

export function GalleryPostFooter({
  post,
  deliveryFailed,
  ...props
}: { post: db.Post; deliveryFailed?: boolean } & ComponentProps<
  typeof XStack
>) {
  const isWindowNarrow = useIsWindowNarrow();
  const retryVerb = useMemo(() => {
    if (isWindowNarrow) {
      return 'Tap';
    } else {
      return 'Click';
    }
  }, [isWindowNarrow]);

  return (
    <View width="100%" pointerEvents="none">
      <XStack
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
          <Text color="$negativeActionText" size="$label/s">
            {retryVerb} to retry
          </Text>
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
  const formattedDate = useMemo(() => {
    return makePrettyShortDate(new Date(post.receivedAt));
  }, [post.receivedAt]);
  const content = usePostContent(post);
  const [viewReactionsOpen, setViewReactionsOpen] = useState(false);

  const firstImage = useMemo(() => {
    const img = content.find((block) => block.type === 'image');
    return img;
  }, [content]);

  const isImagePost = useMemo(() => !!firstImage, [firstImage]);
  const isTextPost = useMemo(() => {
    const type = content[0]?.type;
    return !['embed', 'video', 'image', 'link', 'reference'].includes(type);
  }, [content]);

  const handlePressImage = useCallback(
    (src: string) => {
      logger.log('Detail view: Image pressed, navigating to', src);
      try {
        navigation.navigate('ImageViewer', { uri: src });
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
          testID="GalleryPostContent"
        />
      </View>

      <View gap="$2xl" padding="$xl">
        <DetailViewAuthorRow
          authorId={post.authorId}
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

export function GalleryContentRenderer({
  post,
  ...props
}: {
  post: db.Post;
  onPressImage?: (src: string) => void;
  size?: '$s' | '$l';
} & Omit<ComponentProps<typeof PreviewFrame>, 'content'>) {
  const content = usePostContent(post);
  const previewContent = usePreviewContent(content);

  if (post.hidden) {
    return (
      <ErrorPlaceholder>You have hidden or reported this post</ErrorPlaceholder>
    );
  } else if (post.isDeleted) {
    return <ErrorPlaceholder>This post has been deleted</ErrorPlaceholder>;
  }

  return props.size === '$l' ? (
    <LargePreview content={previewContent} {...props} />
  ) : (
    <SmallPreview content={previewContent} {...props} />
  );
}

function LargePreview({
  content,
  onPressImage,
  ...props
}: { content: PostContent; onPressImage?: (src: string) => void } & Omit<
  ComponentProps<typeof PreviewFrame>,
  'content'
>) {
  return (
    <PreviewFrame {...props} previewType={content[0]?.type ?? 'unsupported'}>
      <LargeContentRenderer content={content} onPressImage={onPressImage} />
    </PreviewFrame>
  );
}

function SmallPreview({
  content,
  ...props
}: { content: PostContent } & Omit<
  ComponentProps<typeof PreviewFrame>,
  'content'
>) {
  const link = useBlockLink(content);
  return link ? (
    <PreviewFrame {...props} previewType="link">
      <LinkPreview link={link} />
    </PreviewFrame>
  ) : (
    <PreviewFrame {...props} previewType={content[0]?.type ?? 'unsupported'}>
      <SmallContentRenderer height={'100%'} content={content} />
    </PreviewFrame>
  );
}

const PreviewFrame = styled(View, {
  name: 'PostPreviewFrame',
  flex: 1,
  borderColor: '$border',
  borderRadius: 0,
  backgroundColor: '$background',
  overflow: 'hidden',
  variants: {
    embedded: {
      true: {
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: 'transparent',
      },
    },
    previewType: (type: BlockType, config: { props: { embedded?: true } }) => {
      if (config.props.embedded) {
        return {};
      }
      switch (type) {
        case 'reference':
          return {
            backgroundColor: '$secondaryBackground',
          };
        case 'paragraph':
        case 'list':
        case 'blockquote':
          return { paddingTop: '$3xl' };
      }
    },
  } as const,
});

function LinkPreview({ link }: { link: { href: string; text?: string } }) {
  const truncatedHref = useMemo(() => {
    return truncate(link?.href ?? '', { length: 100 });
  }, [link?.href]);
  return (
    <View
      flex={1}
      backgroundColor={'$secondaryBackground'}
      padding="$l"
      gap="$xl"
      borderRadius="$m"
    >
      <Icon type="Link" customSize={[17, 17]} />
      <Text size={'$label/s'} color="$secondaryText">
        {link.href !== link.text && link.text && link.text !== ' '
          ? `${link.text}\n\n${truncatedHref}`
          : truncatedHref}
      </Text>
    </View>
  );
}

function useBlockLink(
  content: BlockData[]
): { text: string; href: string } | null {
  return useMemo(() => {
    if (content[0]?.type === 'embed') {
      return { text: content[0].url, href: content[0].url };
    }
    if (content[0]?.type !== 'paragraph') {
      return null;
    }
    for (const inline of content[0].content) {
      if (inline.type === 'link') {
        return inline;
      }
    }
    return null;
  }, [content]);
}

const noWrapperPadding = {
  wrapperProps: {
    padding: 0,
  },
} as const;

const CaptionContentRenderer = createContentRenderer({
  blockSettings: {
    paragraph: {
      size: '$body',
      ...noWrapperPadding,
    },
    image: {
      display: 'none',
    },
  },
});

const LargeContentRenderer = createContentRenderer({
  blockSettings: {
    blockWrapper: {
      padding: '$2xl',
    },
    image: {
      ...noWrapperPadding,
      imageProps: { borderRadius: 0 },
    },
    video: {
      borderRadius: 0,
      ...noWrapperPadding,
    },
    code: {
      borderRadius: 0,
      borderWidth: 0,
      ...noWrapperPadding,
    },
    reference: {
      borderRadius: 0,
      borderWidth: 0,
      contentSize: '$l',
      height: '100%',
      ...noWrapperPadding,
    },
    link: {
      ...noWrapperPadding,
      minHeight: 300,
      renderEmbed: true,
      imageProps: {
        aspectRatio: 1.5,
      },
    },
  },
});

const SmallContentRenderer = createContentRenderer({
  blockSettings: {
    blockWrapper: {
      padding: '$l',
      flex: 1,
    },
    lineText: {
      size: '$label/s',
    },
    image: {
      height: '100%',
      borderRadius: 0,
      imageProps: {
        aspectRatio: 'unset',
        height: '100%',
        contentFit: 'cover',
        borderRadius: 0,
      },
      ...noWrapperPadding,
    },
    video: {
      height: '100%',
      ...noWrapperPadding,
    },
    reference: {
      contentSize: '$s',
      borderRadius: 0,
      borderWidth: 0,
      ...noWrapperPadding,
    },
    code: {
      borderWidth: 0,
      contentSize: '$s',
      textProps: { size: '$mono/s' },
      ...noWrapperPadding,
    },
    link: {
      borderRadius: 0,
      borderWidth: 0,
      renderDescription: false,
      imageProps: {
        height: '66%',
        aspectRatio: 'unset',
      },
      ...noWrapperPadding,
    },
  },
});

function ErrorPlaceholder({ children }: PropsWithChildren) {
  return (
    <View
      backgroundColor={'$secondaryBackground'}
      padding="$m"
      flex={1}
      gap="$m"
    >
      <Icon type="Placeholder" customSize={[24, 17]} />
      <Text size="$label/s" color="$secondaryText">
        {children}
      </Text>
    </View>
  );
}

type GroupedBlocks = {
  [K in BlockType]?: BlockFromType<K>[];
};

function usePreviewContent(content: BlockData[]): BlockData[] {
  return useMemo(() => {
    const groupedBlocks = content.reduce((memo, b) => {
      if (!memo[b.type]) {
        memo[b.type] = [];
      }
      // type mess, better ideas?
      (memo[b.type] as BlockFromType<typeof b.type>[]).push(
        b as BlockFromType<typeof b.type>
      );
      return memo;
    }, {} as GroupedBlocks);

    if (groupedBlocks.reference?.length) {
      return [groupedBlocks.reference[0]];
    } else if (groupedBlocks.image?.length) {
      return [groupedBlocks.image[0]];
    } else if (groupedBlocks.video?.length) {
      return [groupedBlocks.video[0]];
    } else if (groupedBlocks.link?.length) {
      return [groupedBlocks.link[0]];
    }
    return firstBlockIsPreviewable(content) ? content.slice(0, 1) : content;
  }, [content]);
}

function firstBlockIsPreviewable(content: BlockData[]): boolean {
  return (
    content.length > 0 &&
    (content[0].type === 'image' ||
      content[0].type === 'video' ||
      content[0].type === 'reference')
  );
}
