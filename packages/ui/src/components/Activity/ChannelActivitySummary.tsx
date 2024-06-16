import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';

import { useContact } from '../../contexts';
import { Image, SizableText, Text, View, XStack, YStack } from '../../core';
import { getChannelTitle } from '../../utils';
import { Avatar } from '../Avatar';
import { UnreadDot } from '../UnreadDot';
import { ActivitySourceContent } from './ActivitySourceContent';
import { SummaryMessage } from './ActivitySummaryMessage';

export function ChannelActivitySummary({
  summary,
  seenMarker,
  pressHandler,
}: {
  summary: logic.SourceActivityEvents;
  seenMarker: number;
  pressHandler?: () => void;
}) {
  const newestPost = summary.newest;
  const newestPostContact = useContact(newestPost.authorId ?? '');
  const group = newestPost.group ?? undefined;
  const channel: db.Channel | undefined = newestPost.channel ?? undefined;
  const unreadCount =
    summary.type === 'post'
      ? newestPost.channel?.unread?.countWithoutThreads ?? 0
      : newestPost.post?.threadUnread?.count ?? 0;

  const newestIsBlockOrNote =
    (summary.type === 'post' && newestPost.channel?.type === 'gallery') ||
    newestPost.channel?.type === 'notebook';

  return (
    <View
      padding="$l"
      marginBottom="$l"
      backgroundColor={
        newestPost.timestamp > seenMarker ? '$positiveBackground' : 'unset'
      }
      borderRadius="$l"
      onPress={newestIsBlockOrNote ? undefined : pressHandler}
    >
      <XStack>
        <Avatar
          contactId={newestPost.authorId ?? ''}
          contact={newestPostContact}
          borderRadius="$2xl"
          size="$3xl"
          explicitSigilSize={14}
        />
        <YStack marginLeft="$m">
          {channel && (
            <ChannelIndicator
              unreadCount={unreadCount}
              channel={channel}
              group={group}
              sentTime={newestPost.timestamp}
            />
          )}
          <View>
            <SummaryMessage summary={summary} />
          </View>
          <ActivitySourceContent
            summary={summary}
            pressHandler={pressHandler}
          />
        </YStack>
      </XStack>
    </View>
  );
}

export function ChannelIndicator({
  channel,
  group,
  unreadCount,
  sentTime,
}: {
  channel: db.Channel;
  group?: db.Group;
  unreadCount: number;
  sentTime?: number;
}) {
  const title =
    channel.type === 'dm'
      ? 'DM'
      : channel.type === 'groupDm'
        ? 'Group chat'
        : getChannelTitle(channel);

  return (
    <XStack alignItems="center">
      {unreadCount ? <UnreadDot marginRight="$s" /> : null}
      <ChannelIcon channel={channel} group={group} />
      <SizableText marginLeft="$m" fontSize="$s" color="$secondaryText">
        {title}
      </SizableText>
      {sentTime && (
        <SizableText marginLeft="$s" fontSize="$s" color="$secondaryText">
          {logic.makePrettyTime(new Date(sentTime))}
        </SizableText>
      )}
    </XStack>
  );
}

// TODO: we dont really have a sizable channel/group icon, we use hardcoded ListItem everywhere?
export function ChannelIcon({
  channel,
  group,
}: {
  channel: db.Channel;
  group?: db.Group;
}) {
  const SIZE = 14;
  const BORDER_RADIUS = 2;
  const dmContact = useContact(channel.id);

  if (channel.iconImage) {
    return (
      <View height={SIZE} width={SIZE} borderRadius={BORDER_RADIUS}>
        <Image
          width={'100%'}
          height={'100%'}
          contentFit="cover"
          source={{
            uri: channel.iconImage,
          }}
        />
      </View>
    );
  }

  if (group?.iconImage) {
    return (
      <View
        height={SIZE}
        width={SIZE}
        borderRadius={BORDER_RADIUS}
        overflow="hidden"
      >
        <Image
          width={'100%'}
          height={'100%'}
          contentFit="cover"
          source={{
            uri: group.iconImage,
          }}
        />
      </View>
    );
  }

  if (channel.type === 'dm' || channel.type === 'groupDm') {
    return null;
  }

  return (
    <View
      height={SIZE}
      width={SIZE}
      borderRadius={BORDER_RADIUS}
      backgroundColor="$secondaryBackground"
    >
      <View flex={1} alignItems="center" justifyContent="center">
        <Text fontSize={12} color="$primaryText">
          {(group?.title ?? '~').slice(0, 1).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}
