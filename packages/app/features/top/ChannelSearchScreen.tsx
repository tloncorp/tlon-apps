import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannelSearch } from '@tloncorp/shared/dist';
import type * as db from '@tloncorp/shared/dist/db';
import { Button, SearchBar, SearchResults, XStack, YStack } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelSearch'>;

export default function ChannelSearchScreen(props: Props) {
  const channel = props.route.params.channel;

  const [query, setQuery] = useState('');
  const { posts, loading, errored, hasMore, loadMore, searchedThroughDate } =
    useChannelSearch(channel, query);

  const navigateToPost = useCallback(
    (post: db.Post) => {
      if (post.parentId) {
        props.navigation.replace('Post', {
          post: {
            id: post.parentId,
            channelId: post.channelId,
            authorId: post.authorId,
          },
        });
      } else {
        props.navigation.navigate('Channel', {
          channel,
          selectedPostId: post.id,
        });
      }
    },
    [channel, props.navigation]
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <YStack flex={1} paddingHorizontal="$l">
        <XStack gap="$l">
          <SearchBar
            onChangeQuery={setQuery}
            placeholder={`Search ${channel.title}`}
          />
          <Button minimal onPress={() => props.navigation.pop()}>
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
