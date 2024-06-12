import { toPostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as ub from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren } from 'react';

import { useContact } from '../../contexts';
import { Image, SizableText, Text, View, XStack, YStack } from '../../core';
import { getChannelTitle } from '../../utils';
import AuthorRow from '../AuthorRow';
import { Avatar } from '../Avatar';
import ContactName from '../ContactName';
import ContentRenderer from '../ContentRenderer';
import { GalleryPost } from '../GalleryPost';
import { ListItem } from '../ListItem';
import { UnreadDot } from '../UnreadDot';
import { ActivityEventContent } from './ActivityEventContent';
import { SummaryMessage } from './ActivitySummaryMessage';

export function ChannelActivitySummary({
  summary,
  seenMarker,
  pressHandler,
}: {
  summary: db.SourceActivityEvents;
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
            />
          )}
          <View>
            <SummaryMessage
              summary={summary}
              newestPostContact={newestPostContact}
            />
          </View>
          <ActivityEventContent summary={summary} pressHandler={pressHandler} />
        </YStack>
      </XStack>
    </View>
  );
}

export function ChannelIndicator({
  channel,
  group,
  unreadCount,
}: {
  channel: db.Channel;
  group?: db.Group;
  unreadCount: number;
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

  if (channel.type === 'dm') {
    return null;
    // return <Avatar contact={dmContact} contactId={channel.id} size="$xl" />;
  }

  if (channel.type === 'groupDm') {
    // TODO
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

function EventContent({ event }: { event: db.ActivityEvent }) {
  if (!event.content) {
    return null;
  }

  let postContent;
  try {
    // console.log(`trying to parsse ${event.id} content`, event.content);
    const parsed = toPostContent(event.content as ub.Verse[]);
    postContent = parsed[0];
  } catch (e) {
    console.error('Failed to parse event content', e);
    postContent = [] as ub.Verse[];
  }

  if (event.channel?.type === 'gallery') {
    const fakePost = db.buildPendingPost({
      authorId: event.authorId ?? '',
      content: postContent as ub.Story,
      channel: event.channel!,
    }); // hackkkk

    return (
      <View padding="$l">
        <GalleryPost post={fakePost} />
      </View>
    );
  }

  return (
    <View padding="$l">
      {/* {event.authorId && (
        <AuthorRow
          author={event.author}
          authorId={event.authorId}
          sent={event.timestamp}
          type="chat"
        />
      )} */}
      {event.content && (
        <ContentRenderer
          post={{
            id: event.id,
            content: postContent ?? [],
            type: 'diary' as 'chat' | 'gallery' | 'diary',
          }}
        />
      )}
      {/* <SizableText>{event.author}</SizableText> */}
    </View>
  );
}
