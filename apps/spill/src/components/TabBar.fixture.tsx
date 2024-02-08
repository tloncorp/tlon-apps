import * as db from '@db';
import {IconName, Stack, XStack} from '@ochre';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import React from 'react';
import {useValue} from 'react-cosmos/client';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TabBar} from './TabBar';

export const TabNavigator = createBottomTabNavigator();

const icons: IconName[] = ['Channel', 'ChannelTalk', 'ChannelGalleries'];

export default () => {
  const [count] = useValue('count', {defaultValue: 3});
  const insets = useSafeAreaInsets();
  const settings = Array.from({length: count}, () =>
    db.TabSettings.default(),
  ).map((t, i) => {
    return {...t, icon: {...t.icon, value: icons[i % icons.length]!}};
  });

  const tabGroup: db.TabGroupSettings = {
    id: 'default',
    tabs: settings,
  };

  const renderTabBar = (props: BottomTabBarProps) => {
    return <TabBar {...props} insets={insets} tabGroup={tabGroup} />;
  };

  return (
    <Stack flex={1}>
      <TabNavigator.Navigator
        tabBar={renderTabBar}
        screenOptions={{headerShown: false}}>
        <TabNavigator.Screen name="List" component={FakeScreen} />
      </TabNavigator.Navigator>
    </Stack>
  );
};

const FakeScreen = () => {
  return <XStack flex={1} />;
};
