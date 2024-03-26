import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { ClientTypes as Client } from '@tloncorp/shared';
import { GroupList, GroupOptionsSheet, Icon, View } from '@tloncorp/ui';
import React, { useEffect } from 'react';

import { useWebviewPositionContext } from '../contexts/webview/position';
import type { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Groups'>;

export const HomeStack = ({ navigation }: Props) => {
  const { setVisibility } = useWebviewPositionContext();
  const [longPressedGroup, setLongPressedGroup] =
    React.useState<Client.Group | null>(null);

  // TODO: fetch groups from the API
  const pinnedGroups: Client.Group[] = [];
  const otherGroups: Client.Group[] = [
    {
      id: 'test',
      description: 'This is a test group',
      members: [],
      title: 'Test Group',
      iconImage:
        'https://storage.googleapis.com/assets.tlon.io/tlon-co-group-icon.svg',
    },
  ];

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
        pinned={Array.from(pinnedGroups)}
        other={Array.from(otherGroups)}
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
