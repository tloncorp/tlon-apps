import type * as db from '@tloncorp/shared/dist/db';

import { Icon, IconType, XStack } from '../..';
import { ListItem, type ListItemProps } from '../ListItem';

export default function ChannelListItem({
  model,
  icon,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: { icon?: IconType } & ListItemProps<db.Channel>) {
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
          <ListItem.Title>{model.title}</ListItem.Title>
        </XStack>
      </ListItem.MainContent>
      <ListItem.EndContent position="relative" top={3}>
        <Icon type="ChevronRight" />
      </ListItem.EndContent>
    </ListItem>
  );
}
