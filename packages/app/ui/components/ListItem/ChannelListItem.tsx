import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { useMemo, useState } from 'react';
import { View, isWeb } from 'tamagui';

import { useNavigation } from '../../contexts';
import * as utils from '../../utils';
import { capitalize } from '../../utils';
import { Badge } from '../Badge';
import { ChatOptionsSheet } from '../ChatOptionsSheet';
import { ListItem, type ListItemProps } from './ListItem';

export function ChannelListItem({
  model,
  useTypeIcon,
  customSubtitle,
  onPress,
  onLongPress,
  EndContent,
  dimmed,
  disableOptions = false,
  ...props
}: {
  useTypeIcon?: boolean;
  customSubtitle?: string;
  dimmed?: boolean;
} & ListItemProps<db.Channel>) {
  const [open, setOpen] = useState(false);
  const unreadCount = model.unread?.count ?? 0;
  const notified = model.unread?.notify ?? false;
  const title = utils.useChannelTitle(model);
  const firstMemberId = model.members?.[0]?.contactId ?? '';
  const memberCount = model.members?.length ?? 0;
  const isWindowNarrow = useIsWindowNarrow();

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
        onLongPress={isWeb ? undefined : handleLongPress}
        backgroundColor={isFocused ? '$shadow' : undefined}
        hoverStyle={{ backgroundColor: '$secondaryBackground' }}
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
                  notified={notified}
                  count={unreadCount}
                  muted={logic.isMuted(model.volumeSettings?.level, 'channel')}
                  marginRight={isWeb ? '$xl' : 'unset'}
                  marginTop={isWeb ? 3 : 'unset'}
                />
              )}
            </ListItem.EndContent>
          )}
        </ListItem>
      </Pressable>
      {isWeb && !disableOptions && (
        <View position="absolute" right={10} top="$2xl" zIndex={1}>
          {isWindowNarrow ? (
            <Button
              onPress={handleLongPress}
              borderWidth="unset"
              paddingHorizontal={0}
              minimal
            >
              <Icon type="Overflow" />
            </Button>
          ) : (
            <ChatOptionsSheet
              open={open}
              onOpenChange={setOpen}
              chat={{ type: 'channel', id: model.id }}
              trigger={
                <Button
                  backgroundColor="transparent"
                  borderWidth="unset"
                  paddingHorizontal={0}
                  marginHorizontal="$-m"
                  minimal
                >
                  <Icon type="Overflow" />
                </Button>
              }
            />
          )}
        </View>
      )}
    </View>
  );
}
