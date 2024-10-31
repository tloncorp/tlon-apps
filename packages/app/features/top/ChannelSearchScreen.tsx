import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannelSearch, useChannelWithRelations } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { Button, SearchBar, SearchResults, XStack, YStack } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelSearch'>;

export default function ChannelSearchScreen(props: Props) {
  const channelId = props.route.params.channelId;
  const channelQuery = useChannelWithRelations({
    id: channelId,
  });

  const [query, setQuery] = useState('');
  const { posts, loading, errored, hasMore, loadMore, searchedThroughDate } =
    useChannelSearch(channelId, query);

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
          channelId: post.channelId,
          selectedPostId: post.id,
        });
      }
    },
    [props.navigation]
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <YStack flex={1} paddingHorizontal="$l">
        <XStack gap="$l">
          <SearchBar
            onChangeQuery={setQuery}
            placeholder={`Search ${channelQuery?.data?.title ?? ''}`}
            inputProps={{ autoFocus: true }}
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
