import { usePostMeta } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { PropsWithChildren, useCallback, useState } from 'react';
import { SizableText, styled } from 'tamagui';

import { ImageWithFallback, Text, View, XStack } from '../../core';
import { ActionSheet } from '../ActionSheet';
import AuthorRow from '../AuthorRow';
import { Button } from '../Button';
import { ContentReferenceLoader } from '../ContentReference/ContentReference';
import ContentRenderer from '../ContentRenderer';
import { Icon } from '../Icon';
import { useBoundHandler } from '../ListItem/listItemUtils';

const GalleryPostFrame = styled(View, {
  name: 'GalleryPostFrame',
  borderWidth: 1,
  borderColor: '$border',
  position: 'relative',
  borderRadius: '$m',
  overflow: 'hidden',
  flex: 1,
  backgroundColor: '$background',
  variants: {
    previewType: {
      image: {
        borderWidth: 0,
      },
      text: {},
      link: {
        borderWidth: 0,
        backgroundColor: '$secondaryBackground',
      },
      reference: {
        borderWidth: 0,
        backgroundColor: '$secondaryBackground',
      },
      unsupported: {
        borderWidth: 0,
        backgroundColor: '$secondaryBackground',
      },
    },
  } as const,
});

export default function GalleryPost({
  post,
  onPress,
  onLongPress,
  onPressRetry,
  onPressDelete,
  viewMode,
  isHighlighted,
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  viewMode?: 'activity';
  isHighlighted?: boolean;
}) {
  const [showRetrySheet, setShowRetrySheet] = useState(false);

  const handleRetryPressed = useCallback(() => {
    onPressRetry?.(post);
    setShowRetrySheet(false);
  }, [onPressRetry, post]);

  const handleDeletePressed = useCallback(() => {
    onPressDelete?.(post);
    setShowRetrySheet(false);
  }, [onPressDelete, post]);

  const {
    references,
    isText,
    isImage,
    isLink,
    isReference,
    isLinkedImage,
    isRefInText,
    image,
    linkedImage,
  } = usePostMeta(post);

  const handlePress = useBoundHandler(post, onPress);
  const handleLongPress = useBoundHandler(post, onLongPress);

  const previewType = (() => {
    if (isImage || isLinkedImage) {
      return 'image';
    }
    if (isText && !isLinkedImage && !isRefInText && !isLink) {
      return 'text';
    }
    if (isReference || isRefInText) {
      return 'reference';
    }
    if (isLink) {
      return 'link';
    }
    return 'unsupported';
  })();

  return (
    <GalleryPostFrame
      previewType={previewType}
      disabled={viewMode === 'activity'}
      onPress={
        post.deliveryStatus === 'failed'
          ? () => setShowRetrySheet(true)
          : handlePress
      }
      onLongPress={handleLongPress}
    >
      {post.hidden || post.isDeleted ? (
        post.hidden ? (
          <View flex={1} padding="$m">
            <SizableText size="$l" color="$tertiaryText">
              You have hidden or flagged this post.
            </SizableText>
          </View>
        ) : post.isDeleted ? (
          <View flex={1} padding="$m">
            <SizableText size="$l" color="$tertiaryText">
              This post has been deleted.
            </SizableText>
          </View>
        ) : null
      ) : (
        <View flex={1} pointerEvents="none">
          {/** Image post */}
          {(isImage || isLinkedImage) && (
            <ImageWithFallback
              contentFit="cover"
              flex={1}
              fallback={
                <ErrorPlaceholder>
                  Failed to load {isImage ? image!.src : linkedImage}
                </ErrorPlaceholder>
              }
              source={{ uri: isImage ? image!.src : linkedImage }}
            />
          )}

          {/** Text post */}
          {isText && !isLinkedImage && !isRefInText && (
            <View padding="$m" flex={1}>
              {isLink && <Icon type="Link" size="$s" marginBottom="$s" />}
              <ContentRenderer viewMode="block" post={post} />
            </View>
          )}

          {/** Reference post */}
          {(isReference || isRefInText) && (
            <View flex={1}>
              <ContentReferenceLoader
                viewMode="block"
                reference={references[0]}
              />
            </View>
          )}

          {/** Unsupported post */}
          {!isImage && !isText && !isReference && !isRefInText ? (
            <ErrorPlaceholder>Unable to parse content</ErrorPlaceholder>
          ) : null}

          {viewMode !== 'activity' && (
            <View
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              width="100%"
              pointerEvents="none"
            >
              {post.deliveryStatus === 'failed' ? (
                <XStack
                  alignItems="center"
                  paddingLeft="$xl"
                  paddingBottom="$xl"
                >
                  <Text color="$negativeActionText" fontSize="$xs">
                    Message failed to send
                  </Text>
                </XStack>
              ) : (
                <AuthorRow
                  author={post.author}
                  authorId={post.authorId}
                  sent={post.sentAt}
                  type={post.type}
                />
              )}
            </View>
          )}
          <ActionSheet open={showRetrySheet} onOpenChange={setShowRetrySheet}>
            <ActionSheet.ActionTitle>
              Message failed to send
            </ActionSheet.ActionTitle>
            <Button hero onPress={handleRetryPressed}>
              <Button.Text>Retry</Button.Text>
            </Button>
            <Button heroDestructive onPress={handleDeletePressed}>
              <Button.Text>Delete</Button.Text>
            </Button>
          </ActionSheet>
        </View>
      )}
    </GalleryPostFrame>
  );
}

function ErrorPlaceholder({ children }: PropsWithChildren) {
  return (
    <View backgroundColor={'$secondaryBackground'} padding="$m" flex={1}>
      <SizableText size="$s" color="$tertiaryText" textAlign="center">
        {children}
      </SizableText>
    </View>
  );
}
