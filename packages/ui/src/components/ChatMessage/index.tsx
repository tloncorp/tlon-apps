import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit/channel';
import { memo, useMemo } from 'react';

import { useGroup } from '../../contexts';
import { SizableText, View, YStack } from '../../core';
import AuthorRow from './AuthorRow';
import ChatContent from './ChatContent';

const ChatMessage = memo(
  ({
    post,
    firstUnread,
    unreadCount,
  }: {
    post: db.PostWithRelations | db.PostInsertWithAuthor;
    firstUnread?: string;
    unreadCount?: number;
  }) => {
    const group = useGroup(post.groupId ?? '');

    if (!post) {
      return null;
    }

    const isUnread = useMemo(
      () => firstUnread && post.id === firstUnread,
      [firstUnread, post.id]
    );

    const content = useMemo(
      () => JSON.parse(post.content as string) as Story,
      [post.content]
    );
    // const roles = useMemo(
    // () =>
    // group.members
    // ?.find((m) => m.contactId === post.author.id)
    // ?.roles.map((r) => r.roleId),
    // [group, post.author]
    // );

    // const prettyDay = useMemo(() => {
    // const date = new Date(post.sentAt ?? '');
    // return utils.makePrettyDay(date);
    // }, [post.sentAt]);

    return (
      <YStack key={post.id} gap="$l">
        <YStack alignItems="center">
          {isUnread && unreadCount && (
            <SizableText size="$s" fontWeight="$l">
              {unreadCount} unread messages • "Today"
            </SizableText>
          )}
        </YStack>
        <View paddingLeft="$l">
          <AuthorRow
            author={post.author ?? db.getFallbackContact(post.authorId)}
            sent={post.sentAt ?? 0}
            // roles={roles}
          />
        </View>
        <View paddingLeft="$4xl">
          <ChatContent story={content} />
        </View>
      </YStack>
    );
  }
);

export default ChatMessage;
