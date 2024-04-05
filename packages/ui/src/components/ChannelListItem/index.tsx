import { utils } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { Icon, IconType, XStack, YStack } from '../..';
import ContactName from '../ContactName';
import { ListItem, type ListItemProps } from '../ListItem';

export default function ChannelListItem({
  model,
  icon,
  onPress,
  onLongPress,
  ...props
}: { icon?: IconType } & ListItemProps<db.ChannelWithLastPost>) {
  const date = new Date(model.lastPost?.sentAt ?? 0);
  const timeDisplay = useMemo(
    () => utils.makePrettyDayAndDateAndTime(date),
    [date]
  );

  return (
    <ListItem
      {...props}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      {model.iconImage && (
        <ListItem.Icon
          fallbackText={model.title?.[0]}
          imageUrl={model.iconImage ?? undefined}
        />
      )}

      <ListItem.MainContent>
        <XStack alignItems="center" space="$m">
          {!model.iconImage && <Icon type={icon ?? 'ChannelTalk'} />}
          <YStack space="$l">
            <ListItem.Title>{model.title}</ListItem.Title>
            {model.lastPost && (
              <ListItem.Subtitle color="$primaryText">
                <ContactName showAlias name={model.lastPost.authorId} />:{' '}
                {model.lastPost.textContent ?? ''}
              </ListItem.Subtitle>
            )}
          </YStack>
        </XStack>
      </ListItem.MainContent>
      <ListItem.EndContent position="relative" top={3}>
        <YStack space="$m">
          {model.lastPost && (
            <ListItem.Time color="$primaryText">
              {timeDisplay.time}
            </ListItem.Time>
          )}
          {model.unreadCount && model.unreadCount > 0 ? (
            <ListItem.Count>{model.unreadCount}</ListItem.Count>
          ) : null}
        </YStack>
      </ListItem.EndContent>
    </ListItem>
  );
}
