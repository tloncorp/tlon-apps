import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannel, useChannelSearch, useGroup } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { useCallback, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ScreenHeader,
  SearchBar,
  SearchResults,
  View,
  XStack,
  YStack,
  useChannelTitle,
  useGroupTitle,
  useIsWindowNarrow,
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

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScreenHeader
        title={`Search ${title ?? ''}`}
        useHorizontalTitleLayout={!isWindowNarrow}
        backAction={props.navigation.goBack}
        borderBottom
      />
      <View padding="$2xl">
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
      </View>
    </YStack>
  );
}
