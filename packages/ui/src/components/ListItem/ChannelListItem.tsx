import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { useMemo } from 'react';
import { View, isWeb } from 'tamagui';

import { useNavigation } from '../../contexts';
import * as utils from '../../utils';
import { capitalize } from '../../utils';
import { Badge } from '../Badge';
import { Button } from '../Button';
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
  dimmed,
  ...props
}: {
  useTypeIcon?: boolean;
  customSubtitle?: string;
  dimmed?: boolean;
} & ListItemProps<db.Channel>) {
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
          utils.formatUserId(firstMemberId)?.display,
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

  const isFocused = useNavigation().focusedChannelId === model.id;

  return (
    <View>
      <Pressable
        borderRadius="$xl"
        onPress={handlePress}
        onLongPress={handleLongPress}
        backgroundColor={isFocused ? '$secondaryBackground' : undefined}
      >
        <ListItem {...props}>
          <ListItem.ChannelIcon
            model={model}
            useTypeIcon={useTypeIcon}
            dimmed={dimmed}
          />
          <ListItem.MainContent>
            <ListItem.Title dimmed={dimmed}>{title}</ListItem.Title>
            {customSubtitle ? (
              <ListItem.Subtitle>{customSubtitle}</ListItem.Subtitle>
            ) : (model.type === 'dm' || model.type === 'groupDm') &&
              utils.hasNickname(model.members?.[0]?.contact) ? (
              <ListItem.SubtitleWithIcon icon={subtitleIcon}>
                {subtitle}
              </ListItem.SubtitleWithIcon>
            ) : null}
            {model.lastPost && !model.isDmInvite && (
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
                  marginRight={isWeb ? '$s' : 'unset'}
                />
              )}
            </ListItem.EndContent>
          )}
        </ListItem>
      </Pressable>
      {isWeb && (
        <View position="absolute" right="$-2xs" top="$2xl" zIndex={1}>
          <Button
            onPress={handleLongPress}
            borderWidth="unset"
            paddingHorizontal={0}
            marginHorizontal="$-m"
            minimal
          >
            <Icon type="Overflow" />
          </Button>
        </View>
      )}
    </View>
  );
}
