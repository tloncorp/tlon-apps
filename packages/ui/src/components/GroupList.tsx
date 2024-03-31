import * as db from '@tloncorp/shared/dist/db';

import { ScrollView, Text, YGroup } from '../core';
import { GroupListItem } from './GroupListItem';

export function GroupList({
  pinned,
  other,
  onGroupLongPress,
  onGroupPress,
}: {
  pinned: db.Group[];
  other: db.Group[];
  onGroupPress?: (group: db.Group) => void;
  onGroupLongPress?: (group: db.Group) => void;
}) {
  return (
    <ScrollView>
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
          {other.length > 0 && pinned.length > 0 && (
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
    </ScrollView>
  );
}
