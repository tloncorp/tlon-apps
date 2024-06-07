import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { ComponentProps } from 'react';
import { ColorProp } from 'tamagui';

import * as utils from '../../utils';
import { Badge } from '../Badge';
import ContactName from '../ContactName';
import { Icon } from '../Icon';
import {
  ListItem,
  ListItemIconContainer,
  type ListItemProps,
} from '../ListItem';

export default function ChannelListItem({
  model,
  useTypeIcon,
  onPress,
  onLongPress,
  ...props
}: {
  useTypeIcon?: boolean;
} & ListItemProps<db.Channel>) {
  const isMuted = store.useChannelIsMuted(model);
  const title = utils.getChannelTitle(model);

  return (
    <ListItem
      {...props}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      <ChannelListItemIcon
        model={model}
        useTypeIcon={useTypeIcon}
        opacity={isMuted ? 0.2 : 1}
      />
      <ListItem.MainContent>
        <ListItem.Title color={isMuted ? '$tertiaryText' : undefined}>
          {title}
        </ListItem.Title>
        {model.lastPost && (
          <ListItem.Subtitle>
            {model.type !== 'dm' ? (
              <>
                <ContactName
                  showNickname
                  userId={model.lastPost.authorId}
                  size="$s"
                  color="$secondaryText"
                />
                :{' '}
              </>
            ) : null}
            {model.lastPost.textContent ?? ''}
          </ListItem.Subtitle>
        )}
      </ListItem.MainContent>
      {model.isDmInvite ? (
        <ListItem.EndContent justifyContent="center">
          <Badge text="Invite" />
        </ListItem.EndContent>
      ) : (
        <ListItem.EndContent>
          {model.lastPost && <ListItem.Time time={model.lastPost.receivedAt} />}
          <ListItem.Count
            opacity={model.unread?.count || isMuted ? 1 : 0}
            muted={isMuted}
          >
            {model.unread?.count ?? 0}
          </ListItem.Count>
        </ListItem.EndContent>
      )}
    </ListItem>
  );
}

function ChannelListItemIcon({
  model,
  useTypeIcon,
  ...props
}: {
  model: db.Channel;
  useTypeIcon?: boolean;
} & ComponentProps<typeof ListItemIconContainer>) {
  const backgroundColor = model.iconImageColor as ColorProp;
  if (useTypeIcon) {
    const icon = utils.getChannelTypeIcon(model.type);
    return (
      <ListItem.SystemIcon
        icon={icon}
        backgroundColor={'$secondaryBackground'}
        {...props}
      />
    );
  } else if (model.type === 'dm') {
    return (
      <ListItem.AvatarIcon
        backgroundColor={'$transparent'}
        contact={model.members?.[0]?.contact}
        contactId={model.members?.[0]?.contactId ?? model.id}
        rounded
        {...props}
      />
    );
  } else {
    if (model.iconImage) {
      return (
        <ListItem.ImageIcon
          imageUrl={model.iconImage}
          backgroundColor={backgroundColor}
          {...props}
        />
      );
    } else if (hasGroup(model) && model.group.iconImage) {
      return (
        <ListItem.ImageIcon
          imageUrl={model.group.iconImage}
          backgroundColor={backgroundColor}
          {...props}
        />
      );
    } else {
      return (
        <ListItem.TextIcon
          fallbackText={utils.getChannelTitle(model)}
          backgroundColor={backgroundColor}
          {...props}
        />
      );
    }
  }
}

function hasGroup(
  channel: db.Channel
): channel is db.Channel & { group: db.Group } {
  return 'group' in channel && !!channel.group;
}
