import type * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import { useMemo, useRef } from 'react';

import * as utils from '../../utils';
import { capitalize } from '../../utils';
import { Badge } from '../Badge';
import { ListItem, type ListItemProps } from './ListItem';
import { useBoundHandler } from './listItemUtils';

export function ChannelListItem({
  model,
  useTypeIcon,
  customSubtitle,
  onPress,
  onLongPress,
  EndContent,
  ...props
}: {
  useTypeIcon?: boolean;
  customSubtitle?: string;
} & ListItemProps<db.Channel>) {
  const unreadCount = model.unread?.count ?? 0;
  const title = utils.useChannelTitle(model);
  const firstMemberId = model.members?.[0]?.contactId ?? '';
  const memberCount = model.members?.length ?? 0;

  const handlePress = useRef(() => {
    onPress?.(model);
  }).current;

  const handleLongPress = useRef(() => {
    onLongPress?.(model);
  }).current;

  const { subtitle, subtitleIcon } = useMemo(() => {
    if (model.type === 'dm' || model.type === 'groupDm') {
      return {
        subtitle: [
          firstMemberId,
          memberCount > 2 && `and ${memberCount - 1} others`,
        ]
          .filter((v) => !!v)
          .join(' '),
        subtitleIcon: memberCount > 2 ? 'ChannelMultiDM' : 'ChannelDM',
      } as const;
    } else {
      return {
        subtitle: capitalize(model.type),
        subtitleIcon: utils.getChannelTypeIcon(model.type),
      } as const;
    }
  }, [model, firstMemberId, memberCount]);

  return (
    <ListItem {...props} onPress={handlePress} onLongPress={handleLongPress}>
      <ListItem.ChannelIcon
        model={model}
        useTypeIcon={useTypeIcon}
        opacity={
          logic.isMuted(model.volumeSettings?.level, 'channel') ? 0.2 : 1
        }
      />
      <ListItem.MainContent>
        <ListItem.Title
          color={
            logic.isMuted(model.volumeSettings?.level, 'channel')
              ? '$tertiaryText'
              : undefined
          }
        >
          {title}
        </ListItem.Title>
        {customSubtitle ? (
          <ListItem.Subtitle>{customSubtitle}</ListItem.Subtitle>
        ) : (
          <ListItem.SubtitleWithIcon icon={subtitleIcon}>
            {subtitle}
          </ListItem.SubtitleWithIcon>
        )}
        {model.lastPost && (
          <ListItem.PostPreview
            post={model.lastPost}
            showAuthor={model.type !== 'dm'}
          />
        )}
      </ListItem.MainContent>

      {EndContent ?? (
        <ListItem.EndContent>
          {model.lastPost?.receivedAt ? (
            <ListItem.Time time={model.lastPost.receivedAt} />
          ) : null}

          {model.isDmInvite ? (
            <Badge text="Invite" />
          ) : (
            <ListItem.Count
              count={unreadCount}
              muted={logic.isMuted(model.volumeSettings?.level, 'channel')}
            />
          )}
        </ListItem.EndContent>
      )}
    </ListItem>
  );
}
