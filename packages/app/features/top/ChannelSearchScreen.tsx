import { useChannelSearch } from '@tloncorp/shared/dist';
import type * as db from '@tloncorp/shared/dist/db';
import { Button, SearchBar, SearchResults, XStack, YStack } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChannelSearchScreen({
  channel,
  navigateToChannel,
  navigateToReply,
  cancelSearch,
}: {
  channel: db.Channel;
  navigateToChannel: ({
    channel,
    selectedPostId,
  }: {
    channel: db.Channel;
    selectedPostId?: string;
  }) => void;
  navigateToReply: ({
    id,
    authorId,
    channelId,
  }: {
    id: string;
    authorId: string;
    channelId: string;
  }) => void;
  cancelSearch: () => void;
}) {
  const [query, setQuery] = useState('');
  const { posts, loading, errored, hasMore, loadMore, searchedThroughDate } =
    useChannelSearch(channel, query);

  const navigateToPost = useCallback(
    (post: db.Post) => {
      if (post.parentId) {
        navigateToReply({
          id: post.parentId,
          authorId: post.authorId,
          channelId: channel.id,
        });
      } else {
        navigateToChannel({
          channel,
          selectedPostId: post.id,
        });
      }
    },
    [channel, navigateToChannel, navigateToReply]
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <YStack flex={1} paddingHorizontal="$l">
        <XStack gap="$l">
          <SearchBar
            onChangeQuery={setQuery}
            placeholder={`Search ${channel.title}`}
          />
          <Button minimal onPress={() => cancelSearch()}>
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
