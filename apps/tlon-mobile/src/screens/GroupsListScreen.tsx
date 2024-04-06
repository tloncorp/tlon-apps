import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import { GroupList, GroupOptionsSheet, View } from '@tloncorp/ui';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '../types';

type GroupsListScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'GroupsList'
>;

export default function GroupsListScreen(props: GroupsListScreenProps) {
  const [longPressedGroup, setLongPressedGroup] =
    React.useState<db.GroupSummary | null>(null);
  const { pinnedGroups, unpinnedGroups } = db.useGroupsForList() ?? {};
  const { top } = useSafeAreaInsets();

  return (
    <View paddingTop={top} backgroundColor="$background" flex={1}>
      <GroupList
        pinned={Array.from(pinnedGroups ?? [])}
        other={Array.from(unpinnedGroups ?? [])}
        onGroupLongPress={setLongPressedGroup}
        onGroupPress={(group) => {
          props.navigation.navigate('Channel', { group });
        }}
      />
      <GroupOptionsSheet
        open={longPressedGroup !== null}
        onOpenChange={(open) => (!open ? setLongPressedGroup(null) : 'noop')}
        group={longPressedGroup ?? undefined}
      />
    </View>
  );
}
