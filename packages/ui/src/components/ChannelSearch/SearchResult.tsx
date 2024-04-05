import * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { useCallback, useMemo } from 'react';
import { FlatList, Keyboard } from 'react-native';

import { SizableText, Stack, View, XStack, YStack } from '../../core';
import AuthorRow from '../ChatMessage/AuthorRow';
import ChatContent from '../ChatMessage/ChatContent';
import { SearchStatus } from './SearchStatus';
import { SearchState } from './types';

export function SearchResults({
  posts,
  navigateToPost,
  search,
}: {
  posts: db.PostWithRelations[];
  navigateToPost: (post: db.PostWithRelations) => void;
  search: SearchState;
}) {
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
                  <SearchResult post={post} navigateToPost={navigateToPost} />
                )}
                ListFooterComponent={<SearchStatus search={search} />}
              />
            </>
          )}
        </>
      )}
    </YStack>
  );
}

export function SearchResult({
  post,
  navigateToPost,
}: {
  post: db.PostWithRelations;
  navigateToPost: (post: db.PostWithRelations) => void;
}) {
  const story = useMemo(
    () => JSON.parse(post.content as string) as urbit.Story,
    [post.content]
  );

  return (
    <View
      key={post.id}
      borderWidth={1}
      borderColor="$activeBorder"
      borderRadius="$m"
      padding="$m"
      marginBottom="$m"
      onPress={() => navigateToPost(post as unknown as db.PostWithRelations)}
    >
      <AuthorRow
        author={post.author}
        authorId={post.authorId}
        sent={post.sentAt ?? 0}
      />
      <View marginTop="$s">
        <ChatContent story={story} key={post.id} />
      </View>
    </View>
  );
}
