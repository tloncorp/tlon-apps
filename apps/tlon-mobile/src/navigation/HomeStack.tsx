import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as db from '@tloncorp/shared/dist/db';
import { GroupList, GroupOptionsSheet, Icon, View } from '@tloncorp/ui';
import React, { useEffect } from 'react';

import { useWebviewPositionContext } from '../contexts/webview/position';
import type { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Groups'>;

export const HomeStack = ({ navigation }: Props) => {
  const { setVisibility } = useWebviewPositionContext();
  const [longPressedGroup, setLongPressedGroup] =
    React.useState<db.Group | null>(null);

  const { pinnedGroups, unpinnedGroups } = db.useGroupsForList() ?? {};

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Icon
          type="Add"
          pressStyle={{
            backgroundColor: '$secondaryBackground',
            borderRadius: '$s',
          }}
          onPress={() => {}}
        />
      ),
    });

    const unsubscribe = navigation.addListener('tabPress', () => {
      // hide the webview from other tabs
      setVisibility(false);
    });

    return unsubscribe;
  }, [navigation, setVisibility]);

  return (
    <View backgroundColor="$background" flex={1}>
      <GroupList
        pinned={Array.from(pinnedGroups ?? [])}
        other={Array.from(unpinnedGroups ?? [])}
        onGroupLongPress={setLongPressedGroup}
      />
      <GroupOptionsSheet
        open={longPressedGroup !== null}
        onOpenChange={(open) => (!open ? setLongPressedGroup(null) : 'noop')}
        group={longPressedGroup ?? undefined}
      />
    </View>
  );
};
