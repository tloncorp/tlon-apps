import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo } from 'react';
import React from 'react';
import { FlatList, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SizableText, Stack, View, XStack, YStack } from '../../core';
import { ChatMessage } from '../ChatMessage';
import { SearchStatus } from './SearchStatus';
import { SearchState } from './types';

function SearchResultComponent({
  onPress,
  post,
}: {
  onPress: () => void;
  post: db.Post;
}) {
  return (
    <View marginBottom="$m" onPress={onPress}>
      <ChatMessage
        post={post}
        showAuthor
        hideProfilePreview
        onPress={onPress}
      />
    </View>
  );
}
const SearchResult = React.memo(SearchResultComponent);

export function SearchResults({
  posts,
  navigateToPost,
  search,
}: {
  posts: db.Post[];
  navigateToPost: (post: db.Post) => void;
  search: SearchState;
}) {
  const insets = useSafeAreaInsets();

  const onEndReached = useCallback(() => {
    if (!search.loading && search.hasMore) {
      search.loadMore();
    }
  }, [search]);

  const isInitial = search.query === '';

  const renderItem = useCallback(
    ({ item: post }: { item: db.Post }) => (
      <SearchResult onPress={() => navigateToPost(post)} post={post} />
    ),
    [navigateToPost]
  );

  const ListFooterComponent = useMemo(() => {
    return (
      <View marginBottom={insets.bottom}>
        <SearchStatus search={search} />
      </View>
    );
  }, [search, insets.bottom]);

  return (
    <YStack marginTop="$true" flex={1} onTouchStart={Keyboard.dismiss}>
      {isInitial && (
        <Stack flex={1} justifyContent="center" alignItems="center">
          <SizableText color="$secondaryText">
            Enter a search term to get started
          </SizableText>
        </Stack>
      )}

      {!isInitial && (
        <>
          {posts.length === 0 && (
            <YStack alignItems="center" marginTop="$3xl">
              <SizableText color="$secondaryText">No results found</SizableText>
              <SearchStatus search={search} color="$tertiaryText" />
            </YStack>
          )}

          {posts.length > 0 && (
            <>
              <XStack justifyContent="space-between" marginBottom="$xl">
                <SizableText size="$s" color="$secondaryText">
                  Results for "
                  <SizableText size="$s" fontWeight="$xl" color="$primaryText">
                    {search.query}
                  </SizableText>
                  "
                </SizableText>
                <SizableText size="$s" color="$secondaryText">
                  Sorted by:{' '}
                  <SizableText size="$s" fontWeight="$xl" color="$primaryText">
                    most recent
                  </SizableText>
                </SizableText>
              </XStack>

              <FlatList
                data={posts}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.3}
                initialNumToRender={15}
                windowSize={20}
                maxToRenderPerBatch={20}
                renderItem={renderItem}
                ListFooterComponent={ListFooterComponent}
              />
            </>
          )}
        </>
      )}
    </YStack>
  );
}
