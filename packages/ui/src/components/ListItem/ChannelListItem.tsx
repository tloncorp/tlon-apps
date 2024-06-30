import type * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { ColorProp } from '../../types';
import * as utils from '../../utils';
import { capitalize } from '../../utils';
import { Badge } from '../Badge';
import {
  ListItem,
  ListItemIconContainerProps,
  type ListItemProps,
} from './ListItem';
import { isMuted, useBoundHandler } from './listItemUtils';

export function ChannelListItem({
  model,
  useTypeIcon,
  onPress,
  onLongPress,
  ...props
}: {
  useTypeIcon?: boolean;
} & ListItemProps<db.Channel>) {
  const unreadCount = model.unread?.count ?? 0;
  const title = utils.getChannelTitle(model);
  const firstMemberId = model.members?.[0]?.contactId?.replace('~', '') ?? '';
  const memberCount = model.members?.length ?? 0;

  const { subtitle, subtitleIcon } = useMemo(() => {
    if (model.type === 'dm' || model.type === 'groupDm') {
      return {
        subtitle: [
          firstMemberId,
          memberCount > 2 && `and ${memberCount - 1} others`,
        ]
          .filter((v) => !!v)
          .join(' '),
        subtitleIcon: 'Profile',
      } as const;
    } else {
      return {
        subtitle: capitalize(model.type),
        subtitleIcon: utils.getChannelTypeIcon(model.type),
      } as const;
    }
  }, [model, firstMemberId, memberCount]);

  return (
    <ListItem
      {...props}
      onPress={useBoundHandler(model, onPress)}
      onLongPress={useBoundHandler(model, onLongPress)}
    >
      <ChannelListItemIcon
        model={model}
        useTypeIcon={useTypeIcon}
        opacity={isMuted(model) ? 0.2 : 1}
      />
      <ListItem.MainContent>
        <ListItem.Title color={isMuted(model) ? '$tertiaryText' : undefined}>
          {title}
        </ListItem.Title>
        <ListItem.SubtitleWithIcon icon={subtitleIcon}>
          {subtitle}
        </ListItem.SubtitleWithIcon>
        {model.lastPost && (
          <ListItem.PostPreview
            post={model.lastPost}
            showAuthor={model.type !== 'dm'}
          />
        )}
      </ListItem.MainContent>

      <ListItem.EndContent>
        {model.lastPost?.receivedAt ? (
          <ListItem.Time time={model.lastPost.receivedAt} />
        ) : null}

        {model.isDmInvite ? (
          <Badge text="Invite" />
        ) : (
          <ListItem.Count count={unreadCount} muted={isMuted(model)} />
        )}
      </ListItem.EndContent>
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
} & ListItemIconContainerProps) {
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
        backgroundColor={'transparent'}
        contact={model.members?.[0]?.contact}
        contactId={model.members?.[0]?.contactId ?? model.id}
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
          backgroundColor={backgroundColor ?? '$secondaryBackground'}
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
