import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon, Text, View, useStyle } from '@tloncorp/ui';
import React, { useCallback, useEffect } from 'react';
import type { ListRenderItemInfo, StyleProp, ViewStyle } from 'react-native';
import { SectionList } from 'react-native';

import { GroupListItem } from '../components/GroupListItem';
import * as db from '../db';
import type { TabParamList } from '../types';

export const HomeStack = ({
  navigation,
}: NativeStackScreenProps<TabParamList, 'Groups'>) => {
  const pinnedGroups = db.useQuery<db.Group>(
    'Group',
    db.groupQuery({ isPinned: true, sortBy: 'pinIndex' })
  );
  const otherGroups = db.useQuery<db.Group>(
    'Group',
    db.groupQuery({
      isPinned: false,
      sortBy: 'lastPostAt',
      sortDirection: 'desc',
    })
  );

  const renderGroup = useCallback(({ item }: ListRenderItemInfo<db.Group>) => {
    return <GroupListItem model={item} />;
  }, []);

  const contentContainerStyle = useStyle(
    {
      gap: '$s',
      padding: '$l',
    },
    { resolveValues: 'value' }
    // Shouldn't have to cast this, since gap and padding will resolve to
    // numeric values, but I think tamagui's types are off here.
  ) as StyleProp<ViewStyle>;

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
  }, [navigation]);

  return (
    <View backgroundColor="$background" flex={1}>
      <SectionList
        sections={[
          ...(pinnedGroups.length > 0
            ? [{ name: 'Pinned', data: pinnedGroups }]
            : []),
          {
            name: pinnedGroups.length > 0 ? 'Other' : undefined,
            data: otherGroups,
          },
        ]}
        renderItem={renderGroup}
        renderSectionHeader={({ section }) =>
          section.name ? (
            <Text
              paddingHorizontal="$l"
              paddingVertical="$xl"
              fontSize={'$s'}
              color="$secondaryText"
            >
              {section.name}
            </Text>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={contentContainerStyle}
        keyExtractor={getGroupId}
      />
    </View>
  );
};

function getGroupId(group: db.Group) {
  return group.id;
}
