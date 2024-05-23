import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, View, XStack } from '../core';
import { Avatar } from './Avatar';
import ContactName from './ContactName';
import { ListItem } from './ListItem';
import Pressable from './Pressable';

const RoleBadge = ({ role }: { role: string }) => {
  return (
    <View
      borderRadius="$l"
      backgroundColor="$secondaryBackground"
      paddingHorizontal="$s"
    >
      <SizableText color="$secondaryText" size="$s">
        {role}
      </SizableText>
    </View>
  );
};

export default function AuthorRow({
  author,
  authorId,
  sent,
  roles,
  type,
  parentPost,
  setShowComments,
  width,
}: {
  author?: db.Contact | null;
  authorId: string;
  sent: number;
  roles?: string[];
  deliveryStatus?: db.PostDeliveryStatus | null;
  type?: db.PostType;
  parentPost?: db.Post;
  setShowComments?: (show: boolean) => void;
  width?: number;
}) {
  const timeDisplay = useMemo(() => {
    const date = new Date(sent);
    return utils.makePrettyTime(date);
  }, [sent]);
  const firstRole = roles?.[0];

  if (parentPost) {
    return (
      <Pressable onPress={() => setShowComments?.(true)}>
        <XStack
          padding="$l"
          alignItems="center"
          gap="$s"
          justifyContent="space-between"
        >
          <XStack maxWidth="80%" gap="$s" alignItems="center">
            <Avatar
              size="$2xl"
              contact={parentPost.author}
              contactId={parentPost.authorId}
            />
            <ContactName
              maxWidth="80%"
              showNickname
              fontWeight="500"
              userId={parentPost.authorId}
            />
          </XStack>
          <XStack gap="$s" alignItems="center">
            <SizableText color="$primaryText" size="$xs">
              {timeDisplay}
            </SizableText>
            <ListItem.Count>{parentPost.replyCount ?? 0}</ListItem.Count>
          </XStack>
        </XStack>
      </Pressable>
    );
  }

  if (type === 'chat' || type === 'reply') {
    return (
      <XStack gap="$l" alignItems="center">
        <Avatar size="$2xl" contact={author} contactId={authorId} />
        <ContactName showNickname userId={authorId} fontWeight="500" />
        <SizableText
          color="$secondaryText"
          size="$s"
          position="relative"
          top={1}
        >
          {timeDisplay}
        </SizableText>
        {firstRole && <RoleBadge role={firstRole} />}
      </XStack>
    );
  }

  if (type === 'block') {
    return (
      <XStack
        paddingHorizontal="$l"
        width={width}
        overflow="hidden"
        gap="$s"
        alignItems="center"
        justifyContent="space-between"
      >
        <XStack gap="$s" alignItems="center">
          <Avatar size="$2xl" contact={author} contactId={authorId} />
          <ContactName
            maxWidth="65%"
            showNickname
            userId={authorId}
            fontWeight="500"
            // Shadow added so that we can see the author even if the image
            // is dark
            textShadowColor="$background"
            textShadowOffset={{ width: 0, height: 1 }}
            textShadowRadius={8}
            size="$s"
          />
        </XStack>
        <SizableText
          color="$primaryText"
          size="$xs"
          position="relative"
          top={1}
        >
          {timeDisplay}
        </SizableText>
      </XStack>
    );
  }

  if (type === 'note') {
    return (
      <XStack gap="$s" alignItems="center">
        <Avatar size="$2xl" contact={author} contactId={authorId} />
        <ContactName showNickname userId={authorId} />
        <SizableText color="$secondaryText" fontSize="$s">
          {timeDisplay}
        </SizableText>
      </XStack>
    );
  }

  console.log('AuthorRow: unknown post type');

  return null;
}
