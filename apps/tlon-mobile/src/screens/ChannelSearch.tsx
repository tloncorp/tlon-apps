import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SearchBar } from '@tloncorp/ui';
import { useLayoutEffect } from 'react';
import { SafeAreaView } from 'react-native';

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
    </SafeAreaView>
  );
};
