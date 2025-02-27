import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannel, useChannelSearch, useGroup } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  SearchBar,
  SearchResults,
  XStack,
  YStack,
  useChannelTitle,
  useGroupTitle,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelSearch'>;

export default function ChannelSearchScreen(props: Props) {
  const channelId = props.route.params.channelId;
  const groupId = props.route.params.groupId;
  const channelQuery = useChannel({
    id: channelId,
  });
  const groupQuery = useGroup({
    id: groupId,
  });
  const isSingleChannelGroup = groupQuery.data?.channels.length === 1;
  const groupTitle = useGroupTitle(groupQuery.data);
  const channelTitle = useChannelTitle(channelQuery.data ?? null);
  const title = isSingleChannelGroup ? groupTitle : channelTitle;

  const [query, setQuery] = useState('');
  const { posts, loading, errored, hasMore, loadMore, searchedThroughDate } =
    useChannelSearch(channelId, query);

  const { resetToChannel } = useRootNavigation();

  const navigateToPost = useCallback(
    (post: db.Post) => {
      if (post.parentId) {
        props.navigation.replace('Post', {
          postId: post.parentId,
          channelId: post.channelId,
          authorId: post.authorId,
        });
      } else {
        resetToChannel(post.channelId, {
          selectedPostId: post.id,
          groupId,
        });
      }
    },
    [props.navigation, resetToChannel, groupId]
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <YStack flex={1} gap="$l" padding="$l" backgroundColor="$background">
        <XStack>
          <SearchBar
            onChangeQuery={setQuery}
            placeholder={`Search ${title ?? ''}`}
            inputProps={{ autoFocus: true }}
            onPressCancel={() => props.navigation.pop()}
          />
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
