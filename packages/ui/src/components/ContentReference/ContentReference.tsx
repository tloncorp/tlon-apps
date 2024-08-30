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
import { GalleryPost } from '../GalleryPost';
import { IconType } from '../Icon';
import { ListItem } from '../ListItem';
import { ContentRenderer, PostViewMode } from '../PostContent';
import { Text } from '../TextV2';
import {
  Reference,
  ReferenceContext,
  ReferenceProps,
  ReferenceSkeleton,
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
  viewMode,
  ...props
}: ReferenceProps & { channelId: string; post?: db.Post | null }) => {
  const channelType = getChannelType(channelId);
  const meta =
    channelType in typeMeta ? typeMeta[channelType] : typeMeta['chat'];

  return (
    <Reference {...props} viewMode={viewMode} renderMode={post?.type}>
      <Reference.Header>
        <Reference.Title>
          <Reference.TitleIcon type={meta.icon} />
          <Reference.TitleText>{meta.label}</Reference.TitleText>
        </Reference.Title>
        <Reference.ActionIcon />
      </Reference.Header>
      {post?.type === 'block' ? (
        <Reference.Body padding={0} aspectRatio={1}>
          <GalleryPost post={post} viewMode="attachment" />
        </Reference.Body>
      ) : post?.type === 'note' ? (
        <NoteReferenceBody>
          {post.title && (
            <NoteReferenceTitleText>{post.title}</NoteReferenceTitleText>
          )}
          <PostAuthor contactId={post.authorId} />
          {viewMode !== 'block' && (
            <Text size="$body" trimmed={false} numberOfLines={6}>
              {post.textContent}
            </Text>
          )}
        </NoteReferenceBody>
      ) : post ? (
        <Reference.Body>
          <PostAuthor contactId={post.authorId} />
          {viewMode === 'attachment' || viewMode === 'block' ? (
            <Text size="$label/s">{post.textContent}</Text>
          ) : (
            <ContentRenderer viewMode={viewMode} post={post} />
          )}
        </Reference.Body>
      ) : null}
    </Reference>
  );
};

const NoteReferenceBody = styled(Reference.Body, {
  name: 'NoteReferenceBody',
  context: ReferenceContext,
  padding: '$2xl',
  gap: '$2xl',
  variants: {
    viewMode: {
      block: {
        padding: '$l',
        gap: '$l',
      },
    },
  } as const,
});

const NoteReferenceTitleText = styled(Text, {
  name: 'NoteReferenceTitleText',
  context: ReferenceContext,
  size: '$title/l',
  color: '$primaryText',
  variants: {
    viewMode: {
      block: {
        size: '$label/xl',
      },
    },
  },
});

const PostAuthorFrame = styled(XStack, {
  context: ReferenceContext,
  name: 'PostAuthorFrame',
  gap: '$m',
  alignItems: 'center',
  paddingBottom: '$2xs',
});

const PostAuthor = ({
  contactId,
  ...props
}: ComponentProps<typeof XStack> & { contactId: string }) => {
  const contactName = useContactName(contactId);
  return (
    <PostAuthorFrame {...props}>
      <ContactAvatar contactId={contactId} size="$xl" />
      <PostAuthorName viewMode={'block'}>{contactName}</PostAuthorName>
    </PostAuthorFrame>
  );
};

const PostAuthorName = styled(Text, {
  name: 'PostAuthorName',
  context: ReferenceContext,
  color: '$tertiaryText',
  size: '$label/m',
  variants: {
    viewMode: {
      block: {
        size: '$label/s',
      },
    },
  } as const,
});

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
};

// Group reference

export function GroupReferenceLoader({
  groupId,
  openOnPress = true,
  ...props
}: {
  groupId: string;
  viewMode?: PostViewMode;
} & ReferenceProps) {
  const { useGroup } = useRequests();
  const { onPressGroupRef } = useNavigation();
  const { data: group, isLoading, isError, error } = useGroup(groupId);

  const onPress = useCallback(() => {
    if (group) {
      onPressGroupRef?.(group);
    }
  }, [group, onPressGroupRef]);

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
  console.log('group', data, data?.iconImage);
  return (
    <Reference {...props}>
      <Reference.Header
        {...(props.viewMode === 'block' && data?.iconImage !== ''
          ? {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1,
            }
          : {})}
        backgroundColor={'$secondaryBackground'}
      >
        <Reference.Title>
          <Reference.TitleIcon type="Discover" />
          <Reference.TitleText>Group</Reference.TitleText>
        </Reference.Title>
        <Reference.ActionIcon />
      </Reference.Header>
      {data && (
        <Reference.Body padding={0}>
          {props.viewMode === 'block' ? (
            data.iconImage ? (
              <GroupAvatar model={data} width={'100%'} height={'100%'} />
            ) : (
              <View
                width="100%"
                height="100%"
                alignItems="center"
                justifyContent="center"
              >
                <Text size={'$label/xl'} color="secondaryText">
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
