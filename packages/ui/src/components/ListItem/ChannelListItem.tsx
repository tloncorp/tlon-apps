import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { useMemo } from 'react';
import { View } from 'tamagui';
import { isWeb } from 'tamagui';

import * as utils from '../../utils';
import { capitalize } from '../../utils';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Chat } from '../ChatList';
import { Icon } from '../Icon';
import Pressable from '../Pressable';
import { ListItem, type ListItemProps } from './ListItem';

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
} & ListItemProps<Chat> & { model: db.Channel }) {
  const unreadCount = model.unread?.count ?? 0;
  const title = utils.useChannelTitle(model);
  const firstMemberId = model.members?.[0]?.contactId ?? '';
  const memberCount = model.members?.length ?? 0;

  const handlePress = logic.useMutableCallback(() => {
    onPress?.(model);
  });

  const handleLongPress = logic.useMutableCallback(() => {
    onLongPress?.(model);
  });

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
    <View>
      <Pressable
        borderRadius="$xl"
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
        <ListItem {...props}>
          <ListItem.ChannelIcon model={model} useTypeIcon={useTypeIcon} />
          <ListItem.MainContent>
            <ListItem.Title>{title}</ListItem.Title>
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
      </Pressable>
      {isWeb && (
        <View position="absolute" right={-2} top={44} zIndex={1}>
          <Button onPress={handleLongPress} borderWidth="unset" size="$l">
            <Icon type="Overflow" />
          </Button>
        </View>
      )}
    </View>
  );
}
