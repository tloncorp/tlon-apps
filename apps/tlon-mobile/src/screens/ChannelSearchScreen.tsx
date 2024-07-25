import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannelSearch } from '@tloncorp/shared/dist';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  Button,
  SearchBar,
  SearchResults,
  XStack,
  YStack,
  useContacts,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import type { RootStackParamList } from '../types';

type ChannelSearchProps = NativeStackScreenProps<
  RootStackParamList,
  'ChannelSearch'
>;

export default function ChannelSearch({
  route,
  navigation,
}: ChannelSearchProps) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  const { channel } = route.params;
  const [query, setQuery] = useState('');
  const { posts, loading, errored, hasMore, loadMore, searchedThroughDate } =
    useChannelSearch(channel.id, query);

  const navigateToPost = useCallback(
    (post: db.Post) => {
      navigation.navigate('Channel', {
        channel,
        selectedPostId: post.id,
      });
    },
    [channel, navigation]
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <AppDataContextProvider
        currentUserId={currentUserId}
        contacts={contacts ?? []}
      >
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
      </AppDataContextProvider>
    </SafeAreaView>
  );
}
