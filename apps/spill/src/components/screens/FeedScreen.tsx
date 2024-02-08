import {PostListItem} from '@components/ObjectListItem';
import {ChannelToken, GroupToken, ObjectToken} from '@components/ObjectToken';
import {StreamContext} from '@components/StreamContext';
import * as db from '@db';
import {
  Icon,
  ListItem,
  ListItemFrame,
  Sheet,
  SheetHeader,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@ochre';
import {useFormattedTime} from '@utils/format';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, ListRenderItemInfo} from 'react-native';
import {getTokenValue, styled} from 'tamagui';
import {
  NavigationScreenProps,
  useNavigateToChannel,
  useScreenHeight,
} from '@utils/navigation.tsx';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ToggleGroup} from '@components/ToggleGroup';

type FeedGrouping = 'channel' | 'group' | 'post';

export function FeedScreen({navigation}: NavigationScreenProps<'Feed'>) {
  const [grouping, setGrouping] = useState<FeedGrouping>('group');
  const [groupingSheetOpen, setGroupingSheetOpen] = useState(false);
  const handleFilterPressed = useCallback(() => {
    setGroupingSheetOpen(true);
  }, []);

  useEffect(() => {
    // Use `setOptions` to update the button that we previously specified
    // Now the button includes an `onPress` handler to update the count
    navigation.setOptions({
      headerLeft: () => {
        return (
          <Stack
            onPress={handleFilterPressed}
            pressStyle={{backgroundColor: '$secondaryBackground'}}>
            <Icon
              icon="Filter"
              size="$l"
              color="$color"
              onPress={handleFilterPressed}
            />
          </Stack>
        );
      },
    });
  }, [navigation, handleFilterPressed]);

  const insets = useSafeAreaInsets();

  const contentContainerStyle = useMemo(() => {
    return {
      paddingHorizontal: getTokenValue('$size.l'),
      paddingBottom: insets.bottom,
    };
  }, [insets]);

  const handleOpenChanged = useCallback(() => {
    setGroupingSheetOpen(false);
  }, []);

  const handleGroupingChanged = useCallback((newGrouping: FeedGrouping) => {
    setGrouping(newGrouping);
  }, []);

  const handlePressSubmit = useCallback(() => {
    setGroupingSheetOpen(false);
  }, []);

  return (
    <Stack height={useScreenHeight()} backgroundColor={'$background'}>
      <FeedList grouping={grouping} />
      <Sheet
        open={groupingSheetOpen}
        onOpenChange={handleOpenChanged}
        unmountChildrenWhenHidden={true}
        modal={true}
        snapPoints={[33]}
        animation={'quick'}
        dismissOnSnapToBottom={true}>
        <Sheet.Overlay />
        <Sheet.Frame borderRadius={'$l'}>
          <SheetHeader>
            <SheetHeader.LeftControls />
            <SheetHeader.Title>
              <SheetHeader.TitleText>Grouping</SheetHeader.TitleText>
            </SheetHeader.Title>
            <SheetHeader.RightControls>
              <SheetHeader.Button onPress={handlePressSubmit}>
                <SheetHeader.ButtonText>Done</SheetHeader.ButtonText>
              </SheetHeader.Button>
            </SheetHeader.RightControls>
          </SheetHeader>
          <Sheet.ScrollView contentContainerStyle={contentContainerStyle}>
            <YStack padding="$s">
              <ToggleGroup
                vertical={true}
                onChange={handleGroupingChanged}
                value={grouping}
                items={[
                  {
                    label: 'Channel',
                    value: 'channel',
                  },
                  {
                    label: 'Group',
                    value: 'group',
                  },
                  {
                    label: 'Post',
                    value: 'post',
                  },
                ]}
              />
            </YStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
      <XStack
        justifyContent="space-between"
        borderTopColor="$border"
        borderWidth={1}
        paddingHorizontal="$l"
        paddingTop="$s"
        paddingBottom={insets.bottom + 16}>
        <Icon size={'$l'} icon={'Home'} color={'$tertiaryText'} />
        <Icon size={'$l'} icon={'ChannelTalk'} color={'$tertiaryText'} />
        <Icon size={'$l'} icon={'Notifications'} color={'$primaryText'} />
        <Icon size={'$l'} icon={'Discover'} color={'$tertiaryText'} />
        <Icon size={'$l'} icon={'Profile'} color={'$tertiaryText'} />
      </XStack>
    </Stack>
  );
}

function FeedList({grouping}: {grouping?: FeedGrouping}) {
  const Component =
    grouping === 'group'
      ? GroupFeed
      : grouping === 'post'
      ? PostFeed
      : ChannelFeed;

  return <Component />;
}

function GroupFeed() {
  const groups = db.useQuery(
    'Group',
    db.groupQuery({
      sortBy: 'latestPost',
      sortDirection: 'desc',
      updatedAfter: Date.now() - 1000 * 60 * 60 * 24,
    }),
    [],
  );

  const settingsWithDefaults = useMemo(
    () => ({
      ...db.TabSettings.default(),
      view: {
        showGroup: false,
        showChannel: false,
        showTime: false,
      },
    }),
    [],
  );

  const renderItem = useCallback(({item}: ListRenderItemInfo<db.Group>) => {
    return <GroupFeedListItem model={item} />;
  }, []);

  return (
    <StreamContext.Provider value={settingsWithDefaults}>
      <FlatList
        keyExtractor={db.getObjectId}
        data={groups}
        renderItem={renderItem}
        contentContainerStyle={{padding: getTokenValue('$size.s')}}
        ItemSeparatorComponent={Separator}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        windowSize={2}
      />
    </StreamContext.Provider>
  );
}

function ChannelFeed() {
  const channels = db.useQuery('Channel', db.channelQuery(), []);

  const renderItem = useCallback(({item}: ListRenderItemInfo<db.Channel>) => {
    return <ChannelFeedListItem model={item} />;
  }, []);

  const settingsWithDefaults = useMemo(
    () => ({
      ...db.TabSettings.default(),
      view: {
        showGroup: false,
        showChannel: false,
        showTime: false,
      },
    }),
    [],
  );

  return (
    <StreamContext.Provider value={settingsWithDefaults}>
      <FlatList
        keyExtractor={db.getObjectId}
        data={channels}
        renderItem={renderItem}
        contentContainerStyle={{padding: getTokenValue('$size.s')}}
        ItemSeparatorComponent={Separator}
      />
    </StreamContext.Provider>
  );
}

function PostFeed() {
  const posts = db.useQuery(
    'Post',
    db.postQuery({
      sortBy: 'receivedAt',
      sortDirection: 'desc',
    }),
    [],
  );

  const renderItem = useCallback(({item}: ListRenderItemInfo<db.Post>) => {
    return <PostListItem model={item} />;
  }, []);

  return (
    <FlatList
      keyExtractor={db.getObjectId}
      data={posts}
      renderItem={renderItem}
      contentContainerStyle={{padding: getTokenValue('$size.s')}}
      ItemSeparatorComponent={Separator}
    />
  );
}

const Separator = styled(Stack, {
  height: '$s',
});

function GroupFeedListItem({model}: {model: db.Group}) {
  const channels = db.useQuery(
    'Channel',
    db.channelQuery({
      inGroups: [model],
      sortBy: 'latestPost',
      sortDirection: 'desc',
      updatedAfter: Date.now() - 1000 * 60 * 60 * 24,
    }),
    [],
  );

  return (
    <FeedListItem>
      <XStack alignItems="center" gap="$s">
        <GroupToken model={model} />
      </XStack>
      <ListItem.MainContent gap="$m">
        {channels.map(c => {
          return (
            <ChannelFeedListItem
              model={c}
              key={c.id}
              maxPreviewPosts={3}
              showTime={false}
              showGroupLabel={false}
            />
          );
        })}
      </ListItem.MainContent>
    </FeedListItem>
  );
}

function ChannelFeedListItem({
  model,
  maxPreviewPosts = 10,
  showGroupLabel = true,
  showTime = true,
}: {
  model: db.Channel;
  maxPreviewPosts?: number;
  showTime?: boolean;
  showGroupLabel?: boolean;
}) {
  const items = db.useQuery(
    'Post',
    db.postQuery({
      inChannels: [model],
      receivedAfter: Date.now() - 1000 * 60 * 60 * 24,
      sortBy: 'receivedAt',
      sortDirection: 'asc',
    }),
    [],
  );
  const navigateToChannel = useNavigateToChannel(model);
  const handlePress = useCallback(() => {
    navigateToChannel();
  }, [navigateToChannel]);
  const time = useFormattedTime(items[0]?.receivedAt);
  return (
    <FeedListItem onPress={handlePress}>
      <XStack alignItems="center" gap="$s">
        {model.group && showGroupLabel && <GroupToken model={model.group} />}
        <ChannelToken model={model} />
        {showTime && time ? <SizableText size="$s">{time}</SizableText> : null}
      </XStack>

      <ListItem.MainContent flexDirection={'column'}>
        <YStack>
          {items.slice(0, maxPreviewPosts).map((i, index) => {
            const previousItem = items[index - 1];
            const showHeader =
              !previousItem || i.author !== previousItem.author;
            return (
              <PostListItem
                paddingHorizontal={0}
                pressable={false}
                key={i.id}
                model={i}
                showHeader={showHeader}
              />
            );
          })}
        </YStack>
        {items.length > maxPreviewPosts ? (
          <ObjectToken width={'100%'}>
            <ObjectToken.Text flex={1} textAlign="center">
              +{items.length - maxPreviewPosts}
            </ObjectToken.Text>
          </ObjectToken>
        ) : null}
      </ListItem.MainContent>
    </FeedListItem>
  );
}

const FeedListItem = styled(ListItemFrame, {
  flexDirection: 'column',
  borderColor: '$border',
  borderWidth: 1,
});
