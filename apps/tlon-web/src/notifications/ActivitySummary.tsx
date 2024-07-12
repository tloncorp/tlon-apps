import {
  ActivityBundle,
  ActivityEvent,
  Kind,
  PostEvent,
  ReplyEvent,
  getAuthor,
  isMention,
} from '@tloncorp/shared/dist/urbit';
import React, { PropsWithChildren, useMemo } from 'react';

import ShipName from '@/components/ShipName';
import { nestToFlag } from '@/logic/utils';

interface ActivitySummaryProps {
  top: ActivityEvent;
  bundle: ActivityBundle;
}

function getChannelType(event: PostEvent | ReplyEvent): Kind {
  const channel = 'post' in event ? event.post.channel : event.reply.channel;
  const [channelType] = nestToFlag(channel);
  return channelType;
}

function postName(event: ActivityEvent, plural = false) {
  let name = 'message';
  if ('post' in event || 'reply' in event) {
    const channelType = getChannelType(event);
    name =
      channelType === 'heap'
        ? 'block'
        : channelType === 'diary'
          ? 'note'
          : 'message';
  }

  return `${name}${plural ? 's' : ''}`;
}

function postVerb(event: ActivityEvent) {
  if (!('post' in event || 'reply' in event)) {
    throw new Error('Invalid event type for postVerb');
  }

  const channelType = getChannelType(event);
  return channelType === 'heap' || channelType === 'diary' ? 'added' : 'sent';
}

type ActivityRelevancy =
  | 'mention'
  | 'involvedThread'
  | 'replyToGalleryOrNote'
  | 'replyToChatPost'
  | 'dm'
  | 'groupchat'
  | 'postInYourChannel'
  | 'postToChannel';

export function getRelevancy(event: ActivityEvent): ActivityRelevancy {
  if (isMention(event)) {
    return 'mention';
  }

  if ('dm-post' in event && 'ship' in event['dm-post'].whom) {
    return 'dm';
  }

  if ('dm-post' in event && 'club' in event['dm-post'].whom) {
    return 'groupchat';
  }

  if ('reply' in event && event.reply.parent.id.includes(window.our)) {
    const channelType = getChannelType(event);
    if (channelType === 'heap' || channelType === 'diary') {
      return 'replyToGalleryOrNote';
    }

    return 'replyToChatPost';
  }

  if ('post' in event && event.post.channel.includes(`/${window.our}/`)) {
    return 'postInYourChannel';
  }

  if ('reply' in event && event.notified) {
    return 'involvedThread';
  }

  if ('post' in event && event.notified) {
    return 'postToChannel';
  }

  console.log(
    'Unknown relevancy type for activity summary. Defaulting to involvedThread.',
    event
  );
  return 'involvedThread';
}

function SummaryMessageWrapper({ children }: PropsWithChildren) {
  return <div className="text-gray-400 text-sm mr-8">{children}</div>;
}

function ActivitySummary({ top, bundle }: ActivitySummaryProps) {
  const relevancy = getRelevancy(top);
  const count = bundle.events.length;
  const plural = bundle.events.length > 1;
  const otherSet = new Set<string>();
  const topAuthor = getAuthor(top);
  bundle.events.forEach(({ event }) => {
    const author = getAuthor(event);
    if (author && author !== topAuthor) {
      otherSet.add(author);
    }
  });
  const otherAuthors = Array.from(otherSet);

  const NewestAuthor = useMemo(() => {
    return <ShipName className="text-black" name={topAuthor || ''} showAlias />;
  }, [topAuthor]);

  const Authors = useMemo(() => {
    return (
      <>
        <ShipName className="text-black" name={topAuthor || ''} showAlias />
        {otherAuthors[0] && (
          <>
            {`${otherAuthors[1] ? ', ' : ' and '}`}
            <ShipName className="text-black" name={otherAuthors[0]} showAlias />
          </>
        )}
        {otherAuthors[1] && (
          <>
            {', and '}
            <ShipName className="text-black" name={otherAuthors[1]} showAlias />
          </>
        )}
      </>
    );
  }, [topAuthor, otherAuthors]);

  // if it's a mention, life is easy and we just say what it is
  if (relevancy === 'mention') {
    return (
      <SummaryMessageWrapper>
        {NewestAuthor}
        {` mentioned you in a ${postName(top)}`}
      </SummaryMessageWrapper>
    );
  }

  if (relevancy === 'dm') {
    const message =
      count === 1 ? ' sent you a message' : ` sent you ${count} messages`;
    return (
      <SummaryMessageWrapper>
        {NewestAuthor}
        {message}
      </SummaryMessageWrapper>
    );
  }

  if (relevancy === 'groupchat') {
    return (
      <SummaryMessageWrapper>
        {Authors}
        {' messaged the group'}
      </SummaryMessageWrapper>
    );
  }

  if (relevancy === 'postInYourChannel') {
    return (
      <SummaryMessageWrapper>
        {`New ${postName(top, plural)} from `}
        {Authors}
      </SummaryMessageWrapper>
    );
  }

  if (relevancy === 'replyToGalleryOrNote') {
    const message = `commented on your ${postName(top)}`;
    return (
      <SummaryMessageWrapper>
        {Authors}
        {` ${message}`}
      </SummaryMessageWrapper>
    );
  }

  if (relevancy === 'replyToChatPost') {
    const message = `replied to your message`;
    return (
      <SummaryMessageWrapper>
        {Authors}
        {` ${message}`}
      </SummaryMessageWrapper>
    );
  }

  if (relevancy === 'involvedThread') {
    const message = `replied in a thread you're involved in`;
    return (
      <SummaryMessageWrapper>
        {Authors}
        {` ${message}`}
      </SummaryMessageWrapper>
    );
  }

  if (relevancy === 'postToChannel') {
    const message = ` ${postVerb(top)} ${postName(top, plural)} to the channel`;
    return (
      <SummaryMessageWrapper>
        {Authors}
        {message}
      </SummaryMessageWrapper>
    );
  }

  if (bundle.events.length === 1) {
    return (
      <div className="text-gray-400">
        <ShipName className="text-black" name={topAuthor || ''} showAlias />
        {` ${postVerb(top)} a ${postName(top)}`}
      </div>
    );
  }

  const uniqueAuthors = new Set<string>();
  bundle.events.forEach(({ event }) =>
    uniqueAuthors.add(getAuthor(event) ?? '')
  );
  if (uniqueAuthors.size === 1) {
    return (
      <div className="text-gray-400">
        <ShipName
          name={topAuthor ?? ''}
          className="text-black font-semibold"
          showAlias
        />
        {` ${postVerb(top)} ${count} ${postName(top, count > 1)}`}
      </div>
    );
  } else {
    <div className="text-gray-400">
      {`${postVerb(top)} ${count} ${postName(top, count > 1)}`}
    </div>;
  }
}

export default React.memo(ActivitySummary);
