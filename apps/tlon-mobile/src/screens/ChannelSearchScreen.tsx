import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteChannelSearch } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import type { Story } from '@tloncorp/shared/dist/urbit/channel';
import {
  Button,
  SearchBar,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import AuthorRow from '@tloncorp/ui/src/components/ChatMessage/AuthorRow';
import ChatContent from '@tloncorp/ui/src/components/ChatMessage/ChatContent';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard } from 'react-native';
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
  const [query, setQuery] = useState('');
  const {
    results,
    isLoading: searchLoading,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteChannelSearch(channel.id, query);

  const resultIds = useMemo(
    () => results.map((result) => result.id),
    [results]
  );
  const { result: posts, isLoading: readLoading } = db.useChannelSearchResults(
    channel.id ?? '',
    resultIds
  );

  const loading = useMemo(
    () => searchLoading || readLoading,
    [searchLoading, readLoading]
  );

  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      headerShown: false,
      tabBarStyle: { display: 'none' },
    });
  }, [navigation]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <YStack flex={1} paddingHorizontal="$l">
        <XStack gap="$xl" justifyContent="center">
          <SearchBar
            onChangeQuery={setQuery}
            placeholder={`Search ${channel.title}`}
          />
          <Button size="$m" minimal onPress={() => navigation.pop()}>
            <Button.Text>Cancel</Button.Text>
          </Button>
        </XStack>

        <SearchResults
          posts={posts ?? []}
          query={query}
          loading={loading}
          hasMore={hasNextPage}
          loadMore={fetchNextPage}
        />
      </YStack>
    </SafeAreaView>
  );
}

function SearchResults({
  posts,
  query,
  loading,
  hasMore,
  loadMore,
}: {
  posts: db.PostWithRelations[];
  query: string;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}) {
  const postsForDisplay = useMemo(() => {
    return posts?.map((post) => ({
      id: post.id,
      sentAt: post.sentAt ?? 0,
      story: JSON.parse(post.content as string) as Story,
      author: post.author,
      authorId: post.authorId,
    }));
  }, [posts]);

  const onEndReached = useCallback(() => {
    if (!loading && hasMore) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  const isInitial = query === '';

  return (
    <YStack marginTop="$true" flex={1} onTouchStart={Keyboard.dismiss}>
      {isInitial && (
        <Stack flex={1} justifyContent="center" alignItems="center">
          <SizableText size="$l">
            Enter a search term to get started
          </SizableText>
        </Stack>
      )}

      {!isInitial && (
        <>
          {posts.length > 0 && (
            <>
              <XStack justifyContent="space-between" marginBottom="$xl">
                <View>
                  <SizableText size="$s" color="$secondaryText">
                    Results for "
                    <SizableText
                      size="$s"
                      fontWeight="500"
                      color="$primaryText"
                    >
                      {query}
                    </SizableText>
                    "
                  </SizableText>
                </View>
                <View>
                  <SizableText size="$s" color="$secondaryText">
                    Sorted by:{' '}
                    <SizableText
                      size="$s"
                      fontWeight="500"
                      color="$primaryText"
                    >
                      most recent
                    </SizableText>
                  </SizableText>
                </View>
              </XStack>

              <FlatList
                data={postsForDisplay}
                onEndReached={onEndReached}
                renderItem={({ item: post }) => (
                  <View
                    key={post.id}
                    borderWidth={1}
                    borderColor="$activeBorder"
                    borderRadius="$m"
                    padding="$m"
                    marginBottom="$m"
                  >
                    <AuthorRow
                      author={post.author}
                      authorId={post.authorId}
                      sent={post.sentAt}
                    />
                    <View marginTop="$s">
                      <ChatContent story={post.story} key={post.id} />
                    </View>
                  </View>
                )}
              />
            </>
          )}
        </>
      )}
    </YStack>
  );
}
