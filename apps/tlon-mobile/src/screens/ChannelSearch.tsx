import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useInfiniteChannelSearch } from '@tloncorp/shared/dist/api';
import { ScrollView, SearchBar, Text, XStack, YStack } from '@tloncorp/ui';
import { useLayoutEffect, useState } from 'react';
import { Keyboard, SafeAreaView } from 'react-native';

import type { TabParamList } from '../types';

const PLACEHOLDER_CHANNEL = 'chat/~nibset-napwyn/commons';

type Props = BottomTabScreenProps<TabParamList, 'Groups'>;

export const ChannelSearch = ({ navigation }: Props) => {
  const [query, setQuery] = useState('');
  const { results } = useInfiniteChannelSearch(PLACEHOLDER_CHANNEL, query);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      tabBarStyle: { display: 'none' },
    });
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SearchBar onChangeQuery={setQuery} />

      <YStack flex={1} onTouchStart={Keyboard.dismiss}>
        <XStack justifyContent="space-between"></XStack>
        <ScrollView flex={1}>
          {results.map((result) => (
            <Text key={result.id}>{result.textContent}</Text>
          ))}
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
};
