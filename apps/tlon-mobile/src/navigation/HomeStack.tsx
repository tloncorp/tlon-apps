import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Icon } from '@tloncorp/ui';
import React, { useEffect } from 'react';

import { useWebviewPositionContext } from '../contexts/webview/position';
import { useScreenOptions } from '../hooks/useScreenOptions';
import ChannelScreen from '../screens/ChannelScreen';
import ChannelSearch from '../screens/ChannelSearchScreen';
import GroupsListScreen from '../screens/GroupsListScreen';
import type { HomeStackParamList, TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Groups'>;
const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStack = ({ navigation }: Props) => {
  const screenOptions = useScreenOptions({
    overrides: {
      headerShown: false,
    },
  });

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
    <Stack.Navigator
      initialRouteName="GroupsList"
      screenOptions={screenOptions}
    >
      <Stack.Screen name="GroupsList" component={GroupsListScreen} />
      <Stack.Screen name="Channel" component={ChannelScreen} />
      <Stack.Screen name="ChannelSearch" component={ChannelSearch} />
    </Stack.Navigator>
  );
};
