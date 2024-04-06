import * as db from '@tloncorp/shared/dist/db';

import { ScrollView, YStack } from '../core';
import { GroupListItem } from './GroupListItem';
import { ListSectionHeader } from './ListSectionHeader';

export function GroupList({
  pinned,
  other,
  onGroupLongPress,
  onGroupPress,
}: {
  pinned: db.GroupSummary[];
  other: db.GroupSummary[];
  onGroupPress?: (group: db.GroupSummary) => void;
  onGroupLongPress?: (group: db.GroupSummary) => void;
}) {
  return (
    <ScrollView>
      <YStack gap="$s" paddingHorizontal="$l">
        {pinned.length > 0 && <ListSectionHeader>Pinned</ListSectionHeader>}
        {pinned.map((item) => (
          <GroupListItem
            model={item}
            unreadCount={item.unreadCount ?? 0}
            onPress={() => onGroupPress?.(item)}
            onLongPress={() => onGroupLongPress?.(item)}
            key={item.id}
          />
        ))}
        {other.length > 0 && pinned.length > 0 && (
          <ListSectionHeader>Other</ListSectionHeader>
        )}
        {other.map((item) => (
          <GroupListItem
            model={item}
            unreadCount={item.unreadCount ?? 0}
            onPress={() => onGroupPress?.(item)}
            onLongPress={() => onGroupLongPress?.(item)}
            key={item.id}
          />
        ))}
      </YStack>
    </ScrollView>
  );
}
