import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { ScrollView, SearchBar, XStack, YStack } from '@tloncorp/ui';
import { useLayoutEffect } from 'react';
import { Keyboard, SafeAreaView } from 'react-native';

import type { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Groups'>;

export const ChannelSearch = ({ navigation }: Props) => {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      tabBarStyle: { display: 'none' },
    });
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SearchBar />

      <YStack flex={1} onTouchStart={Keyboard.dismiss}>
        <XStack justifyContent="space-between"></XStack>
        <ScrollView flex={1}></ScrollView>
      </YStack>
    </SafeAreaView>
  );
};
