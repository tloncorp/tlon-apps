import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import { useMemo } from 'react';
import { SizableText, View, XStack, YStack } from 'tamagui';

import { ContactAvatar, GroupAvatar } from '../Avatar';
import ContactName from '../ContactName';
import { ActivitySummaryHeader } from './ActivitySummaryHeader';

export function GroupActivitySummary({
  summary,
  seenMarker,
  pressHandler,
}: {
  summary: logic.SourceActivityEvents;
  seenMarker: number;
  pressHandler?: () => void;
}) {
  const newest = summary.newest;
  const group = newest.group ?? undefined;
  const modelUnread = newest.group?.unread ?? null;
  const { data: unread } = store.useLiveGroupUnread(modelUnread);
  const unreadCount = useMemo(() => unread?.notifyCount ?? 0, [unread]);
  const otherSet = new Set<string>();
  summary.all.forEach((event) => {
    if (
      event.groupEventUserId &&
      event.groupEventUserId !== newest.groupEventUserId
    ) {
      otherSet.add(event.groupEventUserId);
    }
  });
  const otherAuthors = Array.from(otherSet);
  const plural = summary.all.length > 1 && otherSet.size > 0;

  const NewestAuthor = useMemo(() => {
    return (
      <ContactName
        fontSize="$s"
        userId={newest.groupEventUserId ?? ''}
        showNickname
      />
    );
  }, [newest.authorId]);

  const Authors = useMemo(() => {
    return (
      <>
        {NewestAuthor}
        {otherAuthors[0] && (
          <>
            {`${otherAuthors[1] ? ', ' : ' and '}`}
            <ContactName fontSize="$s" userId={otherAuthors[0]} showNickname />
          </>
        )}
        {otherAuthors[1] && (
          <>
            {', and '}
            <ContactName fontSize="$s" userId={otherAuthors[1]} showNickname />
          </>
        )}
      </>
    );
  }, [newest.authorId, otherAuthors]);

  return (
    <View
      padding="$m"
      backgroundColor={
        newest.timestamp > seenMarker || unreadCount > 0
          ? '$positiveBackground'
          : 'unset'
      }
      borderRadius="$l"
      onPress={pressHandler}
    >
      <XStack gap="$m">
        <ContactAvatar
          contactId={newest.groupEventUserId ?? ''}
          size="$3xl"
          innerSigilSize={14}
        />
        <YStack gap="$xs" flex={1}>
          {group && (
            <ActivitySummaryHeader
              unreadCount={unreadCount}
              title={group.title ?? ''}
              sentTime={newest.timestamp}
            >
              <GroupAvatar size="$xl" model={group} />
            </ActivitySummaryHeader>
          )}
          <View>
            <SizableText color="$secondaryText" size="$s">
              {Authors}
              {` ${plural ? 'have' : 'has'} requested to join the group`}
            </SizableText>
          </View>
        </YStack>
      </XStack>
    </View>
  );
}
