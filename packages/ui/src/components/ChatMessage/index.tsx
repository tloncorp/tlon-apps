import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit/channel';
import { memo, useMemo } from 'react';

import { useGroup } from '../../contexts';
import { SizableText, View, YStack } from '../../core';
import { useReactionDetails } from '../../utils/postUtils';
import AuthorRow from './AuthorRow';
import ChatContent from './ChatContent';
import { ReactionsDisplay } from './ReactionsDisplay';

const ChatMessage = memo(
  ({
    post,
    firstUnread,
    unreadCount,
    currentUserId,
  }: {
    post: db.PostWithRelations | db.PostInsertWithAuthor;
    currentUserId: string;
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
            author={post.author}
            authorId={post.authorId}
            sent={post.sentAt ?? 0}
            // roles={roles}
          />
        </View>
        <View paddingLeft="$4xl">
          {post.hidden ? (
            <SizableText color="$secondaryText">
              You have hidden or flagged this message.
            </SizableText>
          ) : (
            <ChatContent story={content} />
          )}
        </View>
        <ReactionsDisplay post={post} currentUserId={currentUserId} />
      </YStack>
    );
  }
);

export default ChatMessage;
