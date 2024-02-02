import * as db from '@db';
import {IconName, Stack, XStack} from '@ochre';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import React from 'react';
import {useValue} from 'react-cosmos/client';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TabBar} from './TabBar';

export const TabNavigator = createBottomTabNavigator();

const icons: IconName[] = ['Channel', 'ChannelTalk', 'ChannelGalleries'];

export default () => {
  const [count, setCount] = useValue('count', {defaultValue: 3});
  const insets = useSafeAreaInsets();
  const settings = Array.from({length: count}, () =>
    db.TabSettings.default(),
  ).map((t, i) => {
    t.icon.value = icons[i % icons.length]!;
    return t;
  });

  const renderTabBar = props => {
    return <TabBar {...props} insets={insets} screenSettings={settings} />;
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
