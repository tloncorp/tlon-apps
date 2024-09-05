import { makePrettyShortDate } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { View, XStack, styled } from 'tamagui';

import { DetailViewAuthorRow } from '../AuthorRow';
import { ContactAvatar } from '../Avatar';
import { useBoundHandler } from '../ListItem/listItemUtils';
import { usePostContent } from '../PostContent/contentUtils';
import { SendPostRetrySheet } from '../SendPostRetrySheet';
import { Text } from '../TextV2';
import { GalleryContentRenderer } from './GalleryContentRenderer';

const GalleryPostFrame = styled(View, {
  name: 'GalleryPostFrame',
  maxHeight: '100%',
  overflow: 'hidden',
  aspectRatio: 1,
});

export default function GalleryPost({
  post,
  onPress,
  onLongPress,
  onPressRetry,
  onPressDelete,
  showAuthor = true,
  ...props
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  showAuthor?: boolean;
  isHighlighted?: boolean;
} & ComponentProps<typeof GalleryPostFrame>) {
  const [showRetrySheet, setShowRetrySheet] = useState(false);

  const handleRetryPressed = useCallback(() => {
    onPressRetry?.(post);
    setShowRetrySheet(false);
  }, [onPressRetry, post]);

  const handleDeletePressed = useCallback(() => {
    onPressDelete?.(post);
    setShowRetrySheet(false);
  }, [onPressDelete, post]);

  const handlePress = useCallback(() => {
    post.deliveryStatus === 'failed'
      ? () => setShowRetrySheet(true)
      : onPress?.(post);
  }, [onPress, post]);

  const handleLongPress = useBoundHandler(post, onLongPress);
  const content = usePostContent(post);

  return (
    <GalleryPostFrame
      onPress={handlePress}
      onLongPress={handleLongPress}
      {...props}
    >
      <GalleryContentRenderer
        content={content}
        pointerEvents="none"
        isHidden={!!post.hidden}
        isDeleted={!!post.isDeleted}
        size="$s"
      />
      {showAuthor && !post.hidden && !post.isDeleted && (
        <View
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          width="100%"
          pointerEvents="none"
        >
          {post.deliveryStatus === 'failed' ? (
            <XStack alignItems="center" paddingLeft="$xl" paddingBottom="$xl">
              <Text color="$negativeActionText" size="$label/s">
                Message failed to send
              </Text>
            </XStack>
          ) : (
            <GalleryPostAuthorRow authorId={post.authorId} />
          )}
        </View>
      )}
      <SendPostRetrySheet
        open={showRetrySheet}
        onOpenChange={setShowRetrySheet}
        onPressDelete={handleDeletePressed}
        onPressRetry={handleRetryPressed}
      />
    </GalleryPostFrame>
  );
}

export function GalleryPostDetailView({ post }: { post: db.Post }) {
  const content = usePostContent(post);
  const formattedDate = useMemo(() => {
    return makePrettyShortDate(new Date(post.receivedAt));
  }, [post.receivedAt]);

  return (
    <View paddingBottom="$xs" borderBottomWidth={1} borderColor="$border">
      <View borderTopWidth={1} borderBottomWidth={1} borderColor="$border">
        <GalleryContentRenderer embedded content={content} size="$l" />
      </View>

      <View gap="$xl" padding="$xl">
        <DetailViewAuthorRow authorId={post.authorId} color="$primaryText" />

        {post.title && <Text size="$body">{post.title}</Text>}

        <Text size="$body" color="$tertiaryText">
          {formattedDate}
        </Text>
      </View>
    </View>
  );
}

function GalleryPostAuthorRow({
  authorId,
  ...props
}: { authorId: string } & ComponentProps<typeof XStack>) {
  return (
    <XStack
      padding="$m"
      overflow="hidden"
      gap="$s"
      alignItems="center"
      justifyContent="space-between"
      {...props}
    >
      <ContactAvatar size="$2xl" contactId={authorId} />
    </XStack>
  );
}
