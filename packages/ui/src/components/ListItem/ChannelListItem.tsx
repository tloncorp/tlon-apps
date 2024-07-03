import type * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import * as utils from '../../utils';
import { capitalize } from '../../utils';
import { Badge } from '../Badge';
import { ListItem, type ListItemProps } from './ListItem';
import { isMuted } from './isMuted';
import { useBoundHandler } from './listItemUtils';

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
  const firstMemberId = model.members?.[0]?.contactId ?? '';
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
        subtitleIcon: 'ChannelTalk',
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
      <ListItem.ChannelIcon
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
