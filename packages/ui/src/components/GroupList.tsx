import type * as client from '@tloncorp/shared/dist/client';
import { Text, YGroup } from 'tamagui';

import { GroupListItem } from './GroupListItem';

export function GroupList({
  pinned,
  other,
  onGroupLongPress,
  onGroupPress,
}: {
  pinned: client.Group[];
  other: client.Group[];
  onGroupPress?: (group: client.Group) => void;
  onGroupLongPress?: (group: client.Group) => void;
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
