import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  getSearchResultTelemetryBucket,
  trackProductEvent,
  useChannel,
  useChannelSearch,
  useGroup,
} from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChannelProvider,
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
  const trackedOpenRef = useRef(false);
  const lastTrackedQueryRef = useRef('');

  useEffect(() => {
    if (channelQuery.data && !trackedOpenRef.current) {
      trackedOpenRef.current = true;
      trackProductEvent(AnalyticsEvent.ChannelSearchOpened, {
        channelType: channelQuery.data.type,
        source: 'channel_header',
      });
    }
  }, [channelQuery.data]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (
      normalizedQuery === '' ||
      loading ||
      normalizedQuery === lastTrackedQueryRef.current
    ) {
      return;
    }
    lastTrackedQueryRef.current = normalizedQuery;
    trackProductEvent(AnalyticsEvent.SearchPerformed, {
      resultCountBucket: getSearchResultTelemetryBucket(posts?.length ?? 0),
      surface: 'channel',
    });
  }, [loading, posts?.length, query]);

  const navigateToPost = useCallback(
    (post: db.Post) => {
      trackProductEvent(AnalyticsEvent.ChannelSearchResultSelected, {
        ...logic.getModelAnalytics({ post }),
        hasQuery: query.trim() !== '',
        resultType: post.parentId ? 'reply' : 'post',
        source: 'channel_search',
      });
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
    [props.navigation, query, resetToChannel, groupId]
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
      <View paddingTop="$2xl" flex={1}>
        <XStack marginHorizontal="$m">
          <SearchBar
            onChangeQuery={setQuery}
            placeholder={`Search ${title ?? ''}`}
            inputProps={{ autoFocus: true }}
            onPressCancel={() => props.navigation.pop()}
          />
        </XStack>

        {channelQuery.data != null && (
          <ChannelProvider value={{ channel: channelQuery.data }}>
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
          </ChannelProvider>
        )}
      </View>
    </YStack>
  );
}
