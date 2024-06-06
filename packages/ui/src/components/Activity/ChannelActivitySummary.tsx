import { toPostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as ub from '@tloncorp/shared/dist/urbit';

import { useContact } from '../../contexts';
import { Image, SizableText, Text, View, XStack } from '../../core';
import AuthorRow from '../AuthorRow';
import { Avatar } from '../Avatar';
import ContactName from '../ContactName';
import ContentRenderer from '../ContentRenderer';
import { GalleryPost } from '../GalleryPost';
import { ListItem } from '../ListItem';

export function ChannelActivitySummary({
  summary,
}: {
  summary: db.SourceActivityEvents;
}) {
  console.log(`bl: rendering activity summary for `, summary);
  const newestPost = summary.newest;
  const group = newestPost.group ?? undefined;
  const channel: db.Channel | undefined = newestPost.channel ?? undefined;
  return (
    <View
      padding="$l"
      marginBottom="$l"
      backgroundColor="$gray50"
      borderRadius="$l"
    >
      {channel && <ChannelIndicator channel={channel} group={group} />}
      <View marginTop="$s">
        <ActivityMessage summary={summary} />
      </View>
      <EventContent event={newestPost} />
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
  return (
    <XStack alignItems="center">
      <ChannelIcon channel={channel} group={group} />
      <SizableText marginLeft="$m" fontSize="$s" fontWeight="500">
        {channel.type === 'dm' ? channel.id : channel.title ?? channel.id}
      </SizableText>
    </XStack>
  );
}

export function ActivityMessage({
  summary,
}: {
  summary: db.SourceActivityEvents;
}) {
  const newest = summary.newest;
  const count =
    newest.type === 'reply'
      ? newest.post?.threadUnread?.count ?? summary.all.length
      : newest.channel?.unread?.count ?? summary.all.length;

  if (summary.all.length === 1) {
    return (
      <SizableText color="$secondaryText">
        <ContactName userId={newest.authorId ?? ''} showNickname />
        {` ${postVerb(newest.channel?.type ?? 'chat')} a ${postName(newest)}`}
      </SizableText>
    );
  }

  const uniqueAuthors = new Set<string>();
  summary.all.forEach((event) => uniqueAuthors.add(event.authorId ?? ''));
  if (uniqueAuthors.size === 1) {
    return (
      <SizableText color="$secondaryText">
        <ContactName
          userId={newest.authorId ?? ''}
          fontWeight="500"
          showNickname
        />
        {` ${postVerb(newest.channel?.type ?? 'chat')} ${count} ${postName(newest, count > 1)}`}
      </SizableText>
    );
  } else {
    <SizableText color="$secondaryText">
      {`${postVerb(newest.channel?.type ?? 'chat')} ${count} ${postName(newest, count > 1)}`}
    </SizableText>;
  }
}

function postName(event: db.ActivityEvent, plural?: boolean) {
  const isThread = Boolean(event.parentId);
  const channelType = event.channel?.type ?? 'chat';

  if (isThread) {
    if (channelType === 'gallery' || channelType === 'notebook') {
      return `comment${plural ? 's' : ''}`;
    }
    return plural ? 'replies' : 'reply';
  }

  const name =
    channelType === 'gallery'
      ? 'block'
      : channelType === 'notebook'
        ? 'note'
        : 'message';
  return `${name}${plural ? 's' : ''}`;
}

function postVerb(channelType: string) {
  return channelType === 'gallery'
    ? 'added'
    : channelType === 'notebook'
      ? 'added'
      : 'sent';
}

// TODO: we dont really have a sizable channel/group icon, we use hardcoded ListItem everywhere?
export function ChannelIcon({
  channel,
  group,
}: {
  channel: db.Channel;
  group?: db.Group;
}) {
  const SIZE = '$3xl';
  const BORDER_RADIUS = '$s';
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
    return <Avatar contact={dmContact} contactId={channel.id} size="$3xl" />;
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
