import { utils } from '@tloncorp/shared';
import { addPostReaction, removePostReaction } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit/channel';
import { memo, useMemo } from 'react';

import { useGroup } from '../../contexts';
import { Circle, SizableText, View, XStack, YStack } from '../../core';
import { SizableEmoji } from '../Emoji/SizableEmoji';
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

    const reactReduction = useMemo(() => {
      const reactions = post.reactions;
      const reactionDetails: Record<string, { count: number; self: boolean }> =
        {};

      reactions.forEach((r) => {
        if (!reactionDetails[r.value]) {
          reactionDetails[r.value] = { count: 0, self: false };
        }
        reactionDetails[r.value].count += 1;
        reactionDetails[r.value].self =
          reactionDetails[r.value].self || r.contactId === global.ship; // fix
      });

      return Object.entries(reactionDetails)
        .map(([shortCode, details]) => ({
          shortCode,
          count: details.count,
          self: details.self,
        }))
        .sort((a, b) => b.count - a.count); // Sort primarily by count
    }, [post]);

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
        {reactReduction.length > 0 && (
          <XStack padding="$m" paddingLeft="$4xl" borderRadius="$m">
            {reactReduction.map((reaction) => (
              <XStack
                justifyContent="center"
                alignItems="center"
                backgroundColor={
                  reaction.self ? '$blueSoft' : '$secondaryBackground'
                }
                padding="$xs"
                borderRadius="$m"
                onPress={() =>
                  reaction.self
                    ? removePostReaction(post.channelId, post.id, global.ship)
                    : addPostReaction(
                        post.channelId,
                        post.id,
                        reaction.shortCode,
                        global.ship
                      )
                }
              >
                <SizableEmoji
                  key={reaction.shortCode}
                  shortCode={reaction.shortCode}
                  fontSize="$s"
                />
                {reaction.count > 0 && (
                  <SizableText marginLeft="$s" size="$s" color="$secondaryText">
                    {reaction.count}
                  </SizableText>
                )}
              </XStack>
            ))}
          </XStack>
        )}
      </YStack>
    );
  }
);

export default ChatMessage;
