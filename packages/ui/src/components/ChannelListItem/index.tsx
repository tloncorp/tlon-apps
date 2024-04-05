import type * as db from '@tloncorp/shared/dist/db';

import { Icon, IconType, XStack, YStack } from '../..';
import ContactName from '../ContactName';
import { ListItem, type ListItemProps } from '../ListItem';

export default function ChannelListItem({
  model,
  icon,
  onPress,
  onLongPress,
  unreadCount,
  ...props
}: { icon?: IconType } & ListItemProps<db.ChannelWithLastPost>) {
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
          <YStack space="$s">
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
        <Icon type="ChevronRight" />
      </ListItem.EndContent>
    </ListItem>
  );
}
