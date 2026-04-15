import { makePrettyShortDate } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Image, Text } from '@tloncorp/ui';
import { ComponentProps, useContext, useMemo } from 'react';
import { View, ViewStyle, YStack, createStyledContext, styled } from 'tamagui';

import { DetailViewAuthorRow } from '../AuthorRow';

const IMAGE_HEIGHT = 268;

export function NotebookPostHeader({
  showDate,
  showAuthor,
  post,
  ...props
}: {
  showAuthor?: boolean;
  showDate?: boolean;
  post: db.Post;
} & ComponentProps<typeof NotebookPostHeaderFrame>) {
  const { size } = useContext(NotebookPostContext);
  const formattedDate = useMemo(() => {
    return makePrettyShortDate(new Date(post.receivedAt));
  }, [post.receivedAt]);

  return (
    <NotebookPostHeaderFrame {...props}>
      {!!post.image && size !== '$xs' && (
        <NotebookPostHeroImage
          source={{
            uri:
              post.editStatus === 'failed' || post.editStatus === 'pending'
                ? post.lastEditImage ?? undefined
                : post.image,
          }}
        />
      )}

      <NotebookPostTitle>
        {post.editStatus === 'failed' || post.editStatus === 'pending'
          ? post.lastEditTitle ?? 'Untitled Post'
          : post.title ?? 'Untitled Post'}
      </NotebookPostTitle>

      {showDate && (
        <Text size="$body" color="$tertiaryText">
          {formattedDate}
        </Text>
      )}

      {showAuthor && (
        <DetailViewAuthorRow
          authorId={post.authorId}
          isBot={post.isBot ?? undefined}
          deliveryStatus={post.deliveryStatus}
          editStatus={post.editStatus}
          deleteStatus={post.deleteStatus}
        />
      )}
    </NotebookPostHeaderFrame>
  );
}

const NotebookPostContext = createStyledContext<{
  size: '$l' | '$s' | '$xs';
}>({
  size: '$l',
});

const NotebookPostHeaderFrame = styled(YStack, {
  name: 'NotebookHeaderFrame',
  gap: '$2xl',
  overflow: 'hidden',
});

const NotebookPostHeroImage = styled(Image, {
  context: NotebookPostContext,
  width: '100%',
  height: IMAGE_HEIGHT,
  borderRadius: '$s',
  objectFit: 'cover',
  variants: {
    size: {
      $s: {
        height: IMAGE_HEIGHT / 2,
      },
    },
  } as const,
});

const NotebookPostTitle = styled(Text, {
  context: NotebookPostContext,
  color: '$primaryText',
  size: '$title/l',
  variants: {
    size: {
      $s: { size: '$label/2xl' },
      $l: { size: '$title/l' },
      $xs: { size: '$label/xl' },
    },
  } as const,
});

export const NotebookPostFrame = styled(View, {
  name: 'NotebookPostFrame',
  context: NotebookPostContext,
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$l',
  gap: '$2xl',
  padding: '$xl',
  variants: {
    embedded: {
      true: {
        borderWidth: 0,
        borderRadius: 0,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '$border',
        paddingBottom: '$l',
      },
    },
    size: {} as Record<'$s' | '$l' | '$xs', ViewStyle>,
  } as const,
});
