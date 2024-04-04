import type { NativeStackScreenProps } from '@react-navigation/native-stack';
// import { useInfiniteChannelSearch } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import type { Story } from '@tloncorp/shared/dist/urbit/channel';
import {
  SearchBar,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import AuthorRow from '@tloncorp/ui/src/components/ChatMessage/AuthorRow';
import ChatContent from '@tloncorp/ui/src/components/ChatMessage/ChatContent';
import { Button } from '@tloncorp/ui/src/index';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingSpinner } from '../components/LoadingSpinner';
import useChatSearch from '../hooks/useChatSearch';
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
  const { posts, loading, hasMore, loadMore, searchedThroughDate } =
    useChatSearch(channel.id, query);

  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      headerShown: false,
      tabBarStyle: { display: 'none' },
    });
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
          <View alignItems="center" justifyContent="center">
            <Button minimal onPress={() => navigation.pop()}>
              <Button.Text>Cancel</Button.Text>
            </Button>
          </View>
        </XStack>

        <SearchResults
          posts={posts ?? []}
          query={query}
          loading={loading}
          hasMore={hasMore}
          loadMore={loadMore}
          navigateToPost={navigateToPost}
          searchDetails={{
            query,
            searchComplete: !loading && !hasMore,
            numResults: posts?.length ?? 0,
            searchedThroughDate,
          }}
        />
      </YStack>
    </SafeAreaView>
  );
}

function SearchResults({
  posts,
  loading,
  hasMore,
  loadMore,
  navigateToPost,
  searchDetails,
}: {
  posts: db.PostWithRelations[];
  query: string;
  loading: boolean;
  hasMore: boolean;
  searchDetails: SearchDetails;
  loadMore: () => void;
  navigateToPost: (post: db.PostWithRelations) => void;
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

  const isInitial = searchDetails.query === '';

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
          {posts.length === 0 && !searchDetails.searchComplete && (
            <SearchStatus details={searchDetails} />
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
                      {searchDetails.query}
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
                    onPress={() =>
                      navigateToPost(post as unknown as db.PostWithRelations)
                    }
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
                ListFooterComponent={<SearchStatus details={searchDetails} />}
              />
            </>
          )}
        </>
      )}
    </YStack>
  );
}

interface SearchDetails {
  query: string;
  searchComplete: boolean;
  numResults: number;
  searchedThroughDate: Date | null;
}

function SearchStatus({ details }: { details: SearchDetails }) {
  const { searchComplete, numResults, searchedThroughDate } = details;

  console.log(`search details`, JSON.stringify(details, null, 2));

  return (
    <YStack>
      <XStack>{!searchComplete && <LoadingSpinner height={16} />}</XStack>
      <XStack>
        {numResults > 0 && (
          <SizableText size="$s" color="$secondaryBackground">
            {`${numResults} results found · `}
          </SizableText>
        )}
        {searchedThroughDate && (
          <SizableText size="$s" color="$secondaryBackground">
            Searched through{' '}
            <SizableText size="$s">
              {searchComplete
                ? 'all channel history'
                : searchedThroughDate.toDateString()}
            </SizableText>
          </SizableText>
        )}
      </XStack>
    </YStack>
  );
}
