import type * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { useCalm } from '../../contexts/calm';
import { View, XStack } from '../../core';
import * as utils from '../../utils';
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
  const countToShow = model.unread?.count ?? 0;
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
      <View opacity={model.volumeSettings?.isMuted ? 0.2 : 1}>
        <ListItem.Icon
          fallbackText={model.title?.[0] ?? model.id[0]}
          backgroundColor={getBackgroundColor({
            disableAvatars,
            colors,
            model,
          })}
          imageUrl={
            !disableAvatars && model.iconImage ? model.iconImage : undefined
          }
        />
      </View>
      <ListItem.MainContent>
        <ListItem.Title
          color={model.volumeSettings?.isMuted ? '$tertiaryText' : undefined}
        >
          {model.title ?? model.id}
        </ListItem.Title>
        {model.lastPost && (
          <XStack gap="$xs" alignItems="center">
            <Icon
              type={getLastMessageIcon(model.lastPost.type)}
              color={'$tertiaryText'}
              size={'$s'}
            />
            <ListItem.Subtitle color={'$tertiaryText'}>
              {model.lastChannel}
            </ListItem.Subtitle>
          </XStack>
        )}
        {!isPending && model.lastPost ? (
          <ListItem.Subtitle color="$tertiaryText">
            <ContactName
              userId={model.lastPost.authorId}
              showNickname
              color={'$tertiaryText'}
              size={'$s'}
            />
            : {model.lastPost?.textContent ?? ''}
          </ListItem.Subtitle>
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
          <ListItem.Time color="$tertiaryText" time={model.lastPostAt} />
          <ListItem.Count
            opacity={countToShow > 0 || model.volumeSettings?.isMuted ? 1 : 0}
            muted={model.volumeSettings?.isMuted ?? false}
          >
            {utils.displayableUnreadCount(countToShow)}
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
