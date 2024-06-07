import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, SizeTokens, View, XStack } from '../core';
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

export const AUTHOR_ROW_HEIGHT_DETAIL_VIEW = '$4xl';

export default function AuthorRow({
  author,
  authorId,
  sent,
  roles,
  type,
  detailView,
  width,
}: {
  author?: db.Contact | null;
  authorId: string;
  sent: number;
  roles?: string[];
  deliveryStatus?: db.PostDeliveryStatus | null;
  type?: db.PostType;
  detailView?: boolean;
  width?: SizeTokens;
}) {
  const timeDisplay = useMemo(() => {
    const date = new Date(sent);
    return utils.makePrettyTime(date);
  }, [sent]);
  const firstRole = roles?.[0];

  if (detailView) {
    return (
      <XStack gap="$s" alignItems="center">
        <Avatar size="$2xl" contact={author} contactId={authorId} />
        <ContactName width="100%" showNickname userId={authorId} />
      </XStack>
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
        </XStack>
      </XStack>
    );
  }

  if (type === 'note') {
    return (
      <XStack gap="$s" alignItems="center">
        <Avatar size="$2xl" contact={author} contactId={authorId} />
        <ContactName width="100%" showNickname userId={authorId} />
      </XStack>
    );
  }

  console.log('AuthorRow: unknown post type');

  return null;
}
