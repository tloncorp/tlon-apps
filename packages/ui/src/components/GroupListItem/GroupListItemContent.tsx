import type * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { useCalm } from '../../contexts/calm';
import { XStack } from '../../core';
import { getBackgroundColor } from '../../utils/colorUtils';
import { Badge } from '../Badge';
import ContactName from '../ContactName';
import { Icon } from '../Icon';
import { ListItem, type ListItemProps } from '../ListItem';

export default function GroupListItemContent({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.Group>) {
  const { disableAvatars } = useCalm();
  // Fallback color for calm mode or unset colors
  const colors = { backgroundColor: '$secondaryBackground' };

  const { isPending, statusDisplay, isErrored } = useMemo(
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
        backgroundColor={getBackgroundColor({ disableAvatars, colors, model })}
        imageUrl={
          !disableAvatars && model.iconImage ? model.iconImage : undefined
        }
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
        {model.lastPost && (
          <ListItem.Subtitle color={'$tertiaryText'}>
            {model.lastChannel}
          </ListItem.Subtitle>
        )}
        {!isPending && model.lastPost ? (
          <XStack gap="$xs" alignItems="center">
            <Icon
              type={getLastMessageIcon(model.lastPost.type)}
              color={'$secondaryText'}
              size={'$s'}
            />
            <ListItem.Subtitle>
              <ContactName
                userId={model.lastPost.authorId}
                showNickname
                color={'$secondaryText'}
                size={'$s'}
              />
              : {model.lastPost?.textContent ?? ''}
            </ListItem.Subtitle>
          </XStack>
        ) : null}
      </ListItem.MainContent>
      {statusDisplay ? (
        <ListItem.EndContent>
          <Badge
            text={statusDisplay}
            type={isErrored ? 'warning' : 'positive'}
          />
        </ListItem.EndContent>
      ) : (
        <ListItem.EndContent>
          <ListItem.Time time={model.lastPostAt} />
          <ListItem.Count opacity={model.unreadCount ? 1 : 0}>
            {(model.unreadCount ?? 0) > 99 ? '99+' : model.unreadCount ?? 0}
          </ListItem.Count>
        </ListItem.EndContent>
      )}
    </ListItem>
  );
}

function getLastMessageIcon(type: db.Post['type']) {
  switch (type) {
    case 'chat':
      return 'ChannelTalk';
    case 'block':
      return 'ChannelGalleries';
    case 'note':
      return 'ChannelNotebooks';
    default:
      return 'Channel';
  }
}

type DisplayInfo = {
  statusDisplay: string;
  isPending: boolean;
  isErrored: boolean;
  isNew: boolean;
};

function getDisplayInfo(group: db.Group): DisplayInfo {
  return {
    isPending: group.currentUserIsMember === false,
    isErrored: group.joinStatus === 'errored',
    isNew: group.currentUserIsMember && !!group.isNew,
    statusDisplay:
      group.currentUserIsMember && group.isNew
        ? 'NEW'
        : group.haveRequestedInvite
          ? 'Requested'
          : group.haveInvite
            ? 'Invite'
            : group.joinStatus === 'errored'
              ? 'Errored'
              : group.joinStatus === 'joining'
                ? 'Joining'
                : '',
  };
}
