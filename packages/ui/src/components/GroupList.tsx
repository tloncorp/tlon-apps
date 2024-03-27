import type { ClientTypes } from '@tloncorp/shared';
import { GroupListItem } from './GroupListItem';
import { YGroup, Text } from 'tamagui';

export function GroupList({
  pinned,
  other,
  onGroupLongPress,
  onGroupPress,
}: {
  pinned: ClientTypes.Group[];
  other: ClientTypes.Group[];
  onGroupPress?: (group: ClientTypes.Group) => void;
  onGroupLongPress?: (group: ClientTypes.Group) => void;
}) {
  return (
    <YGroup alignSelf="stretch" gap="$s" padding="$l">
      <YGroup.Item>
        {pinned.length > 0 && (
          <Text
            paddingHorizontal="$l"
            paddingVertical="$xl"
            fontSize="$s"
            color="$secondaryText"
          >
            Pinned
          </Text>
        )}
        {pinned.map((item) => (
          <GroupListItem
            model={item}
            onPress={() => onGroupPress?.(item)}
            onLongPress={() => onGroupLongPress?.(item)}
            key={item.id}
          />
        ))}
      </YGroup.Item>
      <YGroup.Item>
        {other.length > 0 && (
          <Text
            paddingHorizontal="$l"
            paddingVertical="$xl"
            fontSize="$s"
            color="$secondaryText"
          >
            Other
          </Text>
        )}
        {other.map((item) => (
          <GroupListItem
            model={item}
            onPress={() => onGroupPress?.(item)}
            onLongPress={() => onGroupLongPress?.(item)}
            key={item.id}
          />
        ))}
      </YGroup.Item>
    </YGroup>
  );
}
