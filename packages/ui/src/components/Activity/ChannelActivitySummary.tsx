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
import { ActivityEventContent } from './ActivityEventContent';
import { SummaryMessage } from './ActivitySummaryMessage';

export function ChannelActivitySummary({
  summary,
  seenMarker,
}: {
  summary: db.SourceActivityEvents;
  seenMarker: number;
}) {
  console.log(`bl: rendering activity summary for `, summary);
  const newestPost = summary.newest;
  const newestPostContact = useContact(newestPost.authorId ?? '');
  const group = newestPost.group ?? undefined;
  const channel: db.Channel | undefined = newestPost.channel ?? undefined;
  return (
    <View
      padding="$l"
      marginBottom="$l"
      backgroundColor={
        newestPost.timestamp > seenMarker ? '$positiveBackground' : 'unset'
      }
      borderRadius="$l"
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
          {channel && <ChannelIndicator channel={channel} group={group} />}
          <View>
            <SummaryMessage
              summary={summary}
              newestPostContact={newestPostContact}
            />
          </View>
          <ActivityEventContent summary={summary} />
        </YStack>
      </XStack>
    </View>
  );
}

export function ChannelIndicator({
  channel,
  group,
}: {
  channel: db.Channel;
  group?: db.Group;
}) {
  const title =
    channel.type === 'dm'
      ? 'DM'
      : channel.type === 'groupDm'
        ? 'Group chat'
        : getChannelTitle(channel);
  return (
    <XStack alignItems="center">
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
