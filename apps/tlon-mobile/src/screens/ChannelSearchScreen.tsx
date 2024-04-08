import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannelSearch } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { XStack, YStack } from '@tloncorp/ui';
// TODO: update references to dist
import { Button, SearchBar, SearchResults } from '@tloncorp/ui/src/index';
import { useCallback, useLayoutEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '../types';

type ChannelSearchProps = NativeStackScreenProps<
  HomeStackParamList,
  'ChannelSearch'
>;

export default function ChannelSearch({
  route,
  navigation,
}: ChannelSearchProps) {
  const { channel } = route.params;
  const group = db.useGroupByChannel(channel.id);
  const [query, setQuery] = useState('');
  const { posts, loading, errored, hasMore, loadMore, searchedThroughDate } =
    useChannelSearch(channel.id, query);

  // handle full screen view without bottom nav, resets on dismout
  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      headerShown: false,
      tabBarStyle: { display: 'none' },
    });

    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation]);

  const navigateToPost = useCallback(
    (post: db.PostWithRelations) => {
      navigation.navigate('Channel', {
        group: group.result!, // something is wrong here?
        channel,
        selectedPost: post,
      });
    },
    [channel, group.result, navigation]
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <YStack flex={1} paddingHorizontal="$l">
        <XStack gap="$l">
          <SearchBar
            onChangeQuery={setQuery}
            placeholder={`Search ${channel.title}`}
          />
          <Button minimal onPress={() => navigation.pop()}>
            <Button.Text>Cancel</Button.Text>
          </Button>
        </XStack>

        <SearchResults
          posts={posts ?? []}
          navigateToPost={navigateToPost}
          search={{
            query,
            loading,
            errored,
            hasMore,
            loadMore,
            searchComplete: !loading && !hasMore,
            numResults: posts?.length ?? 0,
            searchedThroughDate,
          }}
        />
      </YStack>
    </SafeAreaView>
  );
}
