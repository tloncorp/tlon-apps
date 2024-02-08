import * as db from '@db';
import {SizableText} from '@ochre';
import {useNavigation} from '@react-navigation/native';
import React, {useCallback, useMemo, useState} from 'react';
import {FlatList} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getTokenValue} from 'tamagui';
import {
  navigateToChannel,
  navigateToGroup,
  NavigationProp,
} from '../utils/navigation';
import {useDetailView} from '../utils/state';
import {useSync, useSyncState} from '../utils/sync';
import {useLiveChannelQuery} from '../utils/useLiveChannelQuery';
import {ChannelListItem, GroupListItem, PostListItem} from './ObjectListItem';
import {StreamContext} from './StreamContext';

export interface ObjectListProps {
  settings: db.TabSettings;
  isInverted?: boolean;
  onStartReached?: () => void;
  onEndReached?: () => void;
  initialIndex?: number | null;
}

export function ObjectList(props: ObjectListProps) {
  switch (props.settings.query?.groupBy ?? 'post') {
    case 'group':
      return <GroupList {...props} />;
    case 'channel':
      return <ChannelList {...props} />;
    default:
      return <LivePostList {...props} />;
  }
}

export function BaseObjectList<T>({
  data,
  renderItem,
  getItemKey,
  isInverted,
  onEndReached,
  settings,
}: ObjectListProps & {
  data: ReadonlyArray<T>;
  renderItem: (props: {item: T; index: number}) => JSX.Element;
  getItemKey: (item: T) => string;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {sync} = useSync();

  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await sync();
    setIsRefreshing(false);
  }, [sync]);

  const safeAreaInsets = useSafeAreaInsets();

  const contentContainerStyle = {
    paddingTop: isInverted
      ? safeAreaInsets.bottom +
        getTokenValue('$size.l') +
        10 +
        getTokenValue('$space.s')
      : 0,
    paddingHorizontal: getTokenValue('$m'),
  };

  const scrollIndicatorInsets = useMemo(() => {
    return {bottom: safeAreaInsets.bottom};
  }, [safeAreaInsets]);

  const Header = useMemo(() => {
    return isRefreshing ? <RefreshStatus /> : null;
  }, [isRefreshing]);

  // TODO: Based on how we're typing tabsettings, this shouldn't be necessary,
  // but i've seem some errors where `view` in settings is null. Might be from
  // before I made some changes, but should have some a more coherent way of
  // addressing.
  const settingsWithDefaults = useMemo(
    () => ({
      ...db.TabSettings.default(),
      ...settings,
    }),
    [settings],
  );

  return (
    <StreamContext.Provider value={settingsWithDefaults}>
      <FlatList
        data={data}
        ListHeaderComponent={Header}
        onRefresh={handlePullToRefresh}
        refreshing={isRefreshing}
        onEndReached={onEndReached}
        onEndReachedThreshold={1}
        removeClippedSubviews={true}
        keyExtractor={getItemKey}
        renderItem={renderItem}
        maxToRenderPerBatch={11}
        initialNumToRender={11}
        windowSize={2}
        viewabilityConfig={{
          minimumViewTime: 1000,
          itemVisiblePercentThreshold: 50,
        }}
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={contentContainerStyle}
        automaticallyAdjustsScrollIndicatorInsets={false}
        scrollIndicatorInsets={scrollIndicatorInsets}
        inverted={isInverted}
      />
    </StreamContext.Provider>
  );
}

const RefreshStatus = React.memo(() => {
  const syncState = useSyncState();

  return (
    <SizableText color="$secondaryText" paddingBottom="$s" textAlign="center">
      Syncing:{' '}
      {syncState.stage === 'channels'
        ? 'Loading channel list'
        : syncState.stage === 'posts'
        ? `Syncing channel ${syncState.channelsSynced}/${syncState.channelsToSync}`
        : syncState.stage === 'groups'
        ? 'Syncing group list'
        : ''}
    </SizableText>
  );
});

type PostListProps = ObjectListProps & {
  highlightedPostId?: string | null;
  collapseHeaders?: boolean;
};

export function LivePostList(props: PostListProps) {
  const {query: querySettings} = props.settings;
  const {querySlice, loadMoreAtEnd} = useLiveChannelQuery(querySettings, [
    querySettings,
  ]);
  return <PostList {...props} data={querySlice} onEndReached={loadMoreAtEnd} />;
}

export function PostList({
  highlightedPostId,
  collapseHeaders = true,
  ...props
}: PostListProps & {data: db.Post[]}) {
  const {setActiveDetailView} = useDetailView();

  const navigation = useNavigation<NavigationProp<'Channel'>>();

  const handlePressPost = useCallback(
    (post: db.Post) => {
      if (post.channel) {
        navigateToChannel(navigation, post.channel, post);
      }
    },
    [navigation],
  );

  const handleLongPressPost = useCallback(
    (post: db.Post) => {
      setActiveDetailView({type: 'post', data: post});
    },
    [setActiveDetailView],
  );

  const renderItem = useCallback(
    ({item, index}: {item: db.Post; index: number}) => {
      const itemAbove = props.data[index + (props.isInverted ? 1 : -1)];
      return (
        <PostListItem
          model={item}
          onPress={handlePressPost}
          onLongPress={handleLongPressPost}
          showHeader={!collapseHeaders || itemAbove?.author !== item.author}
          isHighlighted={item.id === highlightedPostId}
        />
      );
    },
    [
      props.data,
      collapseHeaders,
      handlePressPost,
      handleLongPressPost,
      highlightedPostId,
      props.isInverted,
    ],
  );

  return (
    <BaseObjectList
      {...props}
      renderItem={renderItem}
      getItemKey={db.getObjectId}
    />
  );
}

export function GroupList(props: ObjectListProps) {
  const query = db.useQuery(
    'Group',
    groups => {
      return groups
        .filtered('latestPost != NULL')
        .sorted('latestPost.receivedAt', true);
    },
    [],
  );

  const handleLongPressGroup = useCallback(() => {}, []);

  const navigation = useNavigation<NavigationProp<'Group'>>();
  const handlePressGroup = useCallback(
    (group: db.Group) => {
      navigateToGroup(navigation, group);
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({item}: {item: db.Group; index: number}) => {
      return (
        <GroupListItem
          model={item}
          onPress={handlePressGroup}
          onLongPress={handleLongPressGroup}
        />
      );
    },
    [handlePressGroup, handleLongPressGroup],
  );

  return (
    <BaseObjectList
      {...props}
      data={query}
      renderItem={renderItem}
      getItemKey={db.getObjectId}
    />
  );
}

export function ChannelList(props: ObjectListProps) {
  const query = db.useQuery(
    'Channel',
    db.channelQuery(props.settings.query),
    [],
  );

  const {setActiveDetailView} = useDetailView();

  const navigation = useNavigation<NavigationProp<'Channel'>>();

  const handlePressChannel = useCallback(
    (channel: db.Channel) => {
      navigateToChannel(navigation, channel);
    },
    [navigation],
  );

  const handleLongPressChannel = useCallback(
    (channel: db.Channel) => {
      setActiveDetailView({type: 'post', data: channel});
    },
    [setActiveDetailView],
  );

  const renderItem = useCallback(
    ({item}: {item: db.Channel; index: number}) => {
      return (
        <ChannelListItem
          onPress={handlePressChannel}
          onLongPress={handleLongPressChannel}
          model={item}
        />
      );
    },
    [handlePressChannel, handleLongPressChannel],
  );

  return (
    <BaseObjectList
      {...props}
      data={query}
      renderItem={renderItem}
      getItemKey={db.getObjectId}
    />
  );
}
