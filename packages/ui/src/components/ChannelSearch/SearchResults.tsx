import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { FlatList, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SizableText, Stack, View, XStack, YStack } from '../../core';
import ChatMessage from '../ChatMessage';
import { SearchStatus } from './SearchStatus';
import { SearchState } from './types';

export function SearchResults({
  posts,
  navigateToPost,
  search,
}: {
  posts: db.PostInsertWithAuthor[];
  navigateToPost: (post: db.PostWithRelations) => void;
  search: SearchState;
}) {
  const insets = useSafeAreaInsets();

  const onEndReached = useCallback(() => {
    if (!search.loading && search.hasMore) {
      search.loadMore();
    }
  }, [search.loadMore, search.loading, search.hasMore]);

  const isInitial = search.query === '';

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
                <View>
                  <SizableText size="$s" color="$secondaryText">
                    Results for "
                    <SizableText
                      size="$s"
                      fontWeight="500"
                      color="$primaryText"
                    >
                      {search.query}
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
                data={posts}
                onEndReached={onEndReached}
                renderItem={({ item: post }) => (
                  <View
                    marginBottom="$m"
                    onPress={() =>
                      navigateToPost(post as unknown as db.PostWithRelations)
                    }
                  >
                    <ChatMessage post={post} />
                  </View>
                )}
                ListFooterComponent={
                  <View marginBottom={insets.bottom}>
                    <SearchStatus search={search} />
                  </View>
                }
              />
            </>
          )}
        </>
      )}
    </YStack>
  );
}
