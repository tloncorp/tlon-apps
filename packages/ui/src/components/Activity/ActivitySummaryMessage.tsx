import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import React, { Fragment, useMemo } from 'react';
import { styled } from 'tamagui';

import { useCurrentUserId } from '../../contexts';
import { ContactName } from '../ContactNameV2';
import { Text } from '../TextV2';

function SummaryMessageRaw({
  summary,
}: {
  summary: logic.SourceActivityEvents;
}) {
  const currentUserId = useCurrentUserId();
  const relevancy = getRelevancy(summary, currentUserId);
  const newest = summary.newest;
  const count = summary.all.length;
  const plural = summary.all.length > 1;
  const authors = useActivitySummaryAuthors(summary);

  if (authors.length === 1 && relevancy !== 'groupJoinRequest') {
    return null;
  }

  // if it's a mention, life is easy and we just say what it is
  if (relevancy === 'mention') {
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors.slice(0, 1)} />
        {` mentioned you`}:
      </SummaryText>
    );
  }

  if (relevancy === 'groupchat') {
    const message = count === 1 ? ' sent a message' : ` sent ${count} messages`;
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors} />
        {message}:
      </SummaryText>
    );
  }

  if (relevancy === 'postInYourChannel') {
    return (
      <SummaryText>
        {`New ${postName(newest, plural)} from `}
        <ActivitySummaryAuthorList contactIds={authors} />
      </SummaryText>
    );
  }

  if (relevancy === 'replyToGalleryOrNote') {
    const message = `commented on your post`;
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors} />
        {` ${message}`}
      </SummaryText>
    );
  }

  if (relevancy === 'replyToChatPost') {
    const message = `replied to your message`;
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors} />
        {` ${message}`}
      </SummaryText>
    );
  }

  if (relevancy === 'involvedThread') {
    const message = `replied in a thread you're involved in`;
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors} />
        {` ${message}`}
      </SummaryText>
    );
  }

  if (relevancy === 'postToChannel') {
    const message = ` ${postVerb(newest.channel?.type ?? 'chat')} ${postName(newest, plural)}:`;
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors} />
        {message}
      </SummaryText>
    );
  }

  if (relevancy === 'flaggedPost') {
    const message = ` flagged a ${postName(newest)} in your group`;
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors} />
        {message}
      </SummaryText>
    );
  }

  if (relevancy === 'flaggedReply') {
    const message = ` flagged a reply in your group`;
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors} />
        {message}
      </SummaryText>
    );
  }

  if (relevancy === 'groupJoinRequest') {
    return (
      <SummaryText>
        <ActivitySummaryAuthorList contactIds={authors} />
        {` ${plural ? 'have' : 'has'} requested to join the group`}
      </SummaryText>
    );
  }
}

export const SummaryMessage = React.memo(SummaryMessageRaw);

export const SummaryText = styled(Text, {
  size: '$label/m',
  trimmed: false,
});

function postName(event: db.ActivityEvent, plural?: boolean) {
  const name = 'post';
  return `${name}${plural ? 's' : ''}`;
}

function postVerb(channelType: string) {
  return channelType === 'gallery'
    ? 'added'
    : channelType === 'notebook'
      ? 'added'
      : 'sent';
}

type ActivityRelevancy =
  | 'mention'
  | 'involvedThread'
  | 'replyToGalleryOrNote'
  | 'replyToChatPost'
  | 'dm'
  | 'groupchat'
  | 'postInYourChannel'
  | 'postToChannel'
  | 'flaggedPost'
  | 'flaggedReply'
  | 'groupJoinRequest';

export function getRelevancy(
  summary: logic.SourceActivityEvents,
  currentUserId: string
): ActivityRelevancy {
  console.log(
    'getting relevancy',
    summary.newest.type,
    summary.newest.channel?.type
  );
  const newest = summary.newest;

  if (newest.isMention) {
    return 'mention';
  }

  if (newest.type === 'post' && newest.channel?.type === 'dm') {
    return 'dm';
  }

  if (newest.type === 'post' && newest.channel?.type === 'groupDm') {
    return 'groupchat';
  }

  if (
    newest.type === 'reply' &&
    (newest.channel?.type === 'gallery' ||
      newest.channel?.type === 'notebook') &&
    newest.parentAuthorId === currentUserId
  ) {
    return 'replyToGalleryOrNote';
  }

  if (newest.type === 'reply' && newest.parentAuthorId === currentUserId) {
    return 'replyToChatPost';
  }

  if (
    newest.type === 'post' &&
    newest.channelId?.includes(`/${currentUserId}/`)
  ) {
    return 'postInYourChannel';
  }

  if (newest.type === 'reply' && newest.shouldNotify) {
    return 'involvedThread';
  }

  if (newest.type === 'post' && newest.shouldNotify) {
    return 'postToChannel';
  }

  if (newest.type === 'flag-post') {
    return 'flaggedPost';
  }

  if (newest.type === 'flag-reply') {
    return 'flaggedReply';
  }

  if (newest.type === 'group-ask') {
    return 'groupJoinRequest';
  }

  console.log(
    'Unknown relevancy type for activity summary. Defaulting to involvedThread.',
    summary
  );
  return 'involvedThread';
}

export function ActivitySummaryAuthorList({
  contactIds,
}: {
  contactIds: string[];
}) {
  if (!contactIds.length) {
    return null;
  } else if (contactIds.length === 1) {
    return (
      <ContactName color="$positiveActionText" contactId={contactIds[0]} />
    );
  } else if (contactIds.length === 2) {
    return (
      <>
        <ContactName color="$positiveActionText" contactId={contactIds[0]} />
        {' and '}
        <ContactName color="$positiveActionText" contactId={contactIds[1]} />
      </>
    );
  } else {
    const visibleAuthors = contactIds.slice(0, 3);
    const overflowCount = contactIds.length - visibleAuthors.length;
    return (
      <>
        {visibleAuthors.map((contactId, i) => (
          <Fragment key={i}>
            <ContactName
              color="$positiveActionText"
              key={contactId}
              contactId={contactId}
            />
            {i === visibleAuthors.length - 1 && !overflowCount ? '' : ', '}
            {i === visibleAuthors.length - 2 && !overflowCount ? 'and ' : ''}
          </Fragment>
        ))}
        {overflowCount ? `and others` : ''}
      </>
    );
  }
}

export function useActivitySummaryAuthors(summary: logic.SourceActivityEvents) {
  return useMemo(() => {
    const firstAuthorId = db.isGroupEvent(summary.newest)
      ? summary.newest.groupEventUserId
      : summary.newest.authorId;
    const rawIds = db.isGroupEvent(summary.newest)
      ? summary.all.map((p) => p.groupEventUserId)
      : summary.all.map((p) => p.authorId);
    const validIds = rawIds.filter(
      (p): p is string => !!p && p !== firstAuthorId
    );
    const secondaryAuthorIds = [...new Set(validIds)];
    return firstAuthorId
      ? [firstAuthorId, ...secondaryAuthorIds]
      : secondaryAuthorIds;
  }, [summary]);
}
