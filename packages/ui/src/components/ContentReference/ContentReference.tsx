// tamagui-ignore
import { ContentReference } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { getChannelType } from '@tloncorp/shared/dist/urbit';
import { ComponentProps, useCallback } from 'react';
import { View, XStack, styled } from 'tamagui';

import { useNavigation } from '../../contexts';
import { useRequests } from '../../contexts/requests';
import { ContactAvatar, GroupAvatar } from '../Avatar';
import { useContactName } from '../ContactNameV2';
import { GalleryContentRenderer } from '../GalleryPost';
import { IconType } from '../Icon';
import { ListItem } from '../ListItem';
import { useBoundHandler } from '../ListItem/listItemUtils';
import { PostContentRenderer } from '../PostContent/ContentRenderer';
import { Text } from '../TextV2';
import {
  Reference,
  ReferenceContext,
  ReferenceProps,
  ReferenceSkeleton,
  useReferenceContext,
} from './Reference';

// Any reference

export function ContentReferenceLoader({
  reference,
  ...props
}: {
  reference: ContentReference;
} & ReferenceProps) {
  if (reference.referenceType === 'channel') {
    return (
      <PostReferenceLoader
        channelId={reference.channelId}
        postId={reference.postId}
        replyId={reference.replyId}
        {...props}
      />
    );
  } else if (reference.referenceType === 'group') {
    return <GroupReferenceLoader groupId={reference.groupId} {...props} />;
  } else if (reference.referenceType === 'app') {
    return (
      <ReferenceSkeleton
        message="App references are not yet supported"
        messageType="error"
        {...props}
      />
    );
  }

  return (
    <ReferenceSkeleton
      message="Unsupported reference type"
      messageType="error"
      {...props}
    />
  );
}

// Post reference

export function PostReferenceLoader({
  channelId,
  postId,
  replyId,
  openOnPress = true,
  ...props
}: ReferenceProps & {
  channelId: string;
  postId: string;
  replyId?: string;
}) {
  const { usePostReference, useChannel } = useRequests();
  const postQuery = usePostReference({
    postId: replyId ? replyId : postId,
    channelId: channelId,
  });
  const { data: channel } = useChannel({ id: channelId });
  const { onPressRef } = useNavigation();
  const handlePress = useCallback(() => {
    if (channel && postQuery.data) {
      onPressRef?.(channel, postQuery.data);
    }
  }, [channel, onPressRef, postQuery.data]);

  return (
    <PostReference
      channelId={channelId}
      post={postQuery.data}
      isLoading={postQuery.isLoading}
      isError={postQuery.isError}
      errorMessage={postQuery.error?.message}
      hasData={!!postQuery.data}
      onPress={openOnPress ? handlePress : undefined}
      {...props}
    />
  );
}

export const PostReference = ({
  post,
  channelId,
  ...props
}: ReferenceProps & { channelId: string; post?: db.Post | null }) => {
  const channelType = getChannelType(channelId);
  return (
    <Reference {...props} hasData={!!post}>
      <ContentReferenceHeader type={channelType} />
      {post?.type === 'block' ? (
        <BlockReferenceContent post={post} />
      ) : post?.type === 'note' ? (
        <NoteReferenceContent post={post} />
      ) : post ? (
        <ChatReferenceContent post={post} />
      ) : null}
    </Reference>
  );
};

function BlockReferenceContent({ post }: { post: db.Post }) {
  const { contentSize } = useReferenceContext();
  return (
    <Reference.Body
      padding={0}
      aspectRatio={contentSize !== '$l' ? 1 : 'unset'}
    >
      <GalleryContentRenderer embedded post={post} size={contentSize} />
    </Reference.Body>
  );
}

function NoteReferenceContent({ post }: { post: db.Post }) {
  const { contentSize } = useReferenceContext();
  return (
    <Reference.Body>
      <NoteBookReferenceContent>
        {post.title && (
          <NoteReferenceTitleText>{post.title}</NoteReferenceTitleText>
        )}
        <PostReferenceAuthor contactId={post.authorId} />
        {contentSize !== '$s' && (
          <Text size="$body" numberOfLines={6}>
            {post.textContent}
          </Text>
        )}
      </NoteBookReferenceContent>
    </Reference.Body>
  );
}

const NoteBookReferenceContent = styled(View, {
  context: ReferenceContext,
  padding: '$2xl',
  gap: '$2xl',
  variants: {
    contentSize: {
      $s: {
        padding: 0,
        gap: 0,
      },
    },
  },
} as const);

const NoteReferenceTitleText = styled(Text, {
  name: 'NoteReferenceTitleText',
  context: ReferenceContext,
  size: '$title/l',
  color: '$primaryText',
  variants: {
    contentSize: {
      $s: {
        padding: '$l',
        paddingBottom: '$2xs',
        size: '$label/xl',
      },
    },
  },
});

function ChatReferenceContent({ post }: { post: db.Post }) {
  const { contentSize } = useReferenceContext();
  return (
    <Reference.Body>
      <PostReferenceAuthor
        padding="$l"
        paddingBottom="$2xs"
        contactId={post.authorId}
      />
      {contentSize === '$s' ? (
        <Text padding="$l" size="$label/s">
          {post.textContent}
        </Text>
      ) : (
        <PostContentRenderer renderReferences={false} post={post} />
      )}
    </Reference.Body>
  );
}

const PostReferenceAuthor = ({
  contactId,
  ...props
}: ComponentProps<typeof XStack> & { contactId: string }) => {
  const contactName = useContactName(contactId);
  return (
    <PostReferenceAuthorFrame {...props}>
      <ContactAvatar contactId={contactId} size="$xl" />
      <PostReferenceAuthorName>{contactName}</PostReferenceAuthorName>
    </PostReferenceAuthorFrame>
  );
};

const PostReferenceAuthorFrame = styled(XStack, {
  context: ReferenceContext,
  name: 'PostReferenceAuthorFrame',
  gap: '$m',
  alignItems: 'center',
  variants: {
    contentSize: {
      $s: {
        padding: '$l',
        paddingBottom: '$2xs',
      },
    },
  } as const,
});

const PostReferenceAuthorName = styled(Text, {
  name: 'PostReferenceAuthorName',
  context: ReferenceContext,
  color: '$tertiaryText',
  size: '$label/m',
  variants: {
    contentSize: {
      $s: {
        size: '$label/s',
      },
    },
  } as const,
});

// Group reference

export function GroupReferenceLoader({
  groupId,
  openOnPress = true,
  ...props
}: {
  groupId: string;
} & ReferenceProps) {
  const { useGroup } = useRequests();
  const { onPressGroupRef } = useNavigation();
  const { data: group, isLoading, isError, error } = useGroup(groupId);
  const onPress = useBoundHandler(group, onPressGroupRef);

  return (
    <GroupReference
      isLoading={isLoading}
      errorMessage={error?.message}
      isError={isError}
      {...props}
      data={group}
      hasData={!!group}
      onPress={openOnPress ? onPress : undefined}
    />
  );
}

export function GroupReference({
  data,
  ...props
}: { data?: db.Group | null } & ReferenceProps) {
  return (
    <Reference {...props}>
      <ContentReferenceHeader type="group" />
      {data && (
        <Reference.Body padding={0}>
          {props.contentSize === '$s' ? (
            data.iconImage ? (
              <GroupAvatar
                model={data}
                width={'100%'}
                height={'100%'}
                aspectRatio={'unset'}
                borderRadius={0}
              />
            ) : (
              <View
                width="100%"
                height="100%"
                alignItems="center"
                justifyContent="center"
              >
                <Text
                  size={'$label/xl'}
                  color="$secondaryText"
                  textAlign="center"
                  paddingHorizontal="$m"
                >
                  {data.title}
                </Text>
              </View>
            )
          ) : (
            <ListItem
              pressable={false}
              backgroundColor={'transparent'}
              gap="$m"
            >
              <ListItem.GroupIcon model={data} />
              <ListItem.MainContent>
                <ListItem.Title>{data.title ?? data.id}</ListItem.Title>
                <ListItem.Subtitle>{data.description}</ListItem.Subtitle>
              </ListItem.MainContent>
            </ListItem>
          )}
        </Reference.Body>
      )}
    </Reference>
  );
}

const typeMeta: Record<string, { label: string; icon: IconType }> = {
  gallery: {
    label: 'Gallery Post',
    icon: 'ChannelGalleries',
  },
  notebook: {
    label: 'Notebook Post',
    icon: 'ChannelNotebooks',
  },
  chat: {
    label: 'Chat Post',
    icon: 'ChannelTalk',
  },
  group: {
    label: 'Group',
    icon: 'Discover',
  },
};

function ContentReferenceHeader({ type }: { type: keyof typeof typeMeta }) {
  const meta = type in typeMeta ? typeMeta[type] : typeMeta['chat'];
  return (
    <Reference.Header>
      <Reference.Title>
        <Reference.TitleIcon type={meta.icon} />
        <Reference.TitleText>{meta.label}</Reference.TitleText>
      </Reference.Title>
      <Reference.ActionIcon />
    </Reference.Header>
  );
}
