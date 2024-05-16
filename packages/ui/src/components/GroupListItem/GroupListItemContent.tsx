import type * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, Stack } from '../../core';
import ContactName from '../ContactName';
import { ListItem, type ListItemProps } from '../ListItem';

export default function GroupListItemContent({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.Group>) {
  const { isPending, statusDisplay } = useMemo(
    () => getDisplayInfo(model),
    [model]
  );

  return (
    <ListItem
      {...props}
      alignItems={isPending ? 'center' : 'stretch'}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        backgroundColor={model.iconImageColor ?? undefined}
        imageUrl={model.iconImage ?? undefined}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
        {!isPending && model.lastPost ? (
          <ListItem.Subtitle>
            <ContactName
              userId={model.lastPost.authorId}
              showNickname
              color={'$secondaryText'}
              size={'$s'}
            />
            : {model.lastPost?.textContent ?? ''}
          </ListItem.Subtitle>
        ) : null}
      </ListItem.MainContent>
      <ListItem.EndContent>
        {statusDisplay ? (
          <Stack
            backgroundColor="$positiveBackground"
            paddingVertical="$xs"
            paddingHorizontal="$l"
            borderRadius="$xl"
          >
            <SizableText size="$s" color="$positiveActionText">
              {statusDisplay}
            </SizableText>
          </Stack>
        ) : (
          <>
            <ListItem.Time time={model.lastPostAt} />
            {model.unreadCount && model.unreadCount > 0 ? (
              <ListItem.Count>{model.unreadCount}</ListItem.Count>
            ) : null}
          </>
        )}
      </ListItem.EndContent>
    </ListItem>
  );
}

type DisplayInfo = {
  statusDisplay: string;
  isPending: boolean;
  isNew: boolean;
};

function getDisplayInfo(group: db.Group): DisplayInfo {
  return {
    isPending: group.currentUserIsMember === false,
    isNew: !group.currentUserIsMember && !!group.isNew,
    statusDisplay:
      !group.currentUserIsMember && group.isNew
        ? 'NEW'
        : group.haveInvite
          ? 'Invited'
          : group.joinStatus === 'errored'
            ? 'Errored'
            : group.joinStatus === 'joining'
              ? 'Joining'
              : '',
  };
}
