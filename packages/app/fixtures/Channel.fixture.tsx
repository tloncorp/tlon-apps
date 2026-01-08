import { useQuery } from '@tanstack/react-query';
import {
  useChannelPreview,
  useGroupPreview,
  usePostWithRelations,
} from '@tloncorp/shared';
import {
  ChannelContentConfiguration,
  CollectionRendererId,
} from '@tloncorp/shared/api';
import type * as db from '@tloncorp/shared/db';
import { range } from 'lodash';
import type { ComponentProps, PropsWithChildren, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, SafeAreaView, Switch, View } from 'react-native';
import { Label, XStack, YStack } from 'tamagui';

import {
  AppDataContextProvider,
  Channel,
  ChatOptionsProvider,
  Sheet,
} from '../ui';
import { UnconnectedChannelConfigurationBar as ChannelConfigurationBar } from '../ui/components/ManageChannels/CreateChannelSheet';
import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePost,
  createFakePosts,
  group,
  initialContacts,
  tlonLocalBulletinBoard,
  tlonLocalGettingStarted,
  tlonLocalIntros,
} from './fakeData';

const posts = createFakePosts(100);
const notebookPosts = createFakePosts(5, 'note');

const usePostReference = ({
  postId,
}: {
  postId: string;
  channelId: string;
}) => {
  return useQuery({
    queryFn: () => posts.find((p) => p.id === postId) ?? null,
    queryKey: ['post', postId],
  });
};

function noopProps<T extends object>() {
  return new Proxy<T>({} as unknown as T, {
    get: (_target, prop) => () => console.log(`${String(prop)} called`),
  });
}

const ChannelFixtureWrapper = ({
  children,
}: PropsWithChildren<{ theme?: 'light' | 'dark' }>) => {
  return (
    <AppDataContextProvider contacts={initialContacts}>
      <FixtureWrapper fillWidth fillHeight>
        <ChatOptionsProvider {...noopProps()}>{children}</ChatOptionsProvider>
      </FixtureWrapper>
    </AppDataContextProvider>
  );
};

const baseProps: ComponentProps<typeof Channel> = {
  posts: posts,
  channel: tlonLocalIntros,
  negotiationMatch: true,
  isLoadingPosts: false,
  group: group,
  goBack: () => {},
  goToSearch: () => {},
  goToDm: () => {},
  goToPost: () => {},
  goToImageViewer: () => {},
  goToUserProfile: () => {},
  goToGroupSettings: () => {},
  markRead: () => {},
  onPressRef: () => {},
  usePost: usePostWithRelations,
  usePostReference: usePostReference,
  useChannel: useChannelPreview,
  useGroup: useGroupPreview,
  onGroupAction: () => {},
  getDraft: async () => ({}),
  storeDraft: async () => {},
  clearDraft: async () => {},
  onPressRetrySend: async () => {},
  onPressRetryLoad: () => {},
  onPressDelete: () => {},
} as const;

export const ChannelFixture = (props: {
  theme?: 'light' | 'dark';
  negotiationMatch?: boolean;
  passedProps?: (
    baseProps: ComponentProps<typeof Channel>
  ) => Partial<ComponentProps<typeof Channel>>;
  children?: (opts: {
    channel: db.Channel;
    setChannel: (update: SetStateAction<db.Channel>) => void;
  }) => React.ReactNode;
}) => {
  const [channel, setChannel] = useState<db.Channel>(tlonLocalIntros);
  const channelProps = useMemo(
    () => ({
      ...baseProps,
      negotiationMatch: props.negotiationMatch ?? true,
    }),
    [props.negotiationMatch]
  );

  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel {...channelProps} {...props.passedProps?.(channelProps)} />
      {props.children?.({
        channel,
        setChannel,
      })}
    </ChannelFixtureWrapper>
  );
};

export const GalleryChannelFixture = (props: { theme?: 'light' | 'dark' }) => {
  const [posts] = useState(() => createFakePosts(10, 'block'));

  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel {...baseProps} posts={posts} channel={tlonLocalBulletinBoard} />
    </ChannelFixtureWrapper>
  );
};

export const NotebookChannelFixture = (props: { theme?: 'light' | 'dark' }) => {
  return (
    <ChannelFixtureWrapper theme={props.theme}>
      <Channel
        {...baseProps}
        posts={notebookPosts}
        channel={tlonLocalGettingStarted}
      />
    </ChannelFixtureWrapper>
  );
};

function useSimulatedPostsQuery({
  getPostAt = () => createFakePost(),
}: Partial<{
  getPostAt: (index: number) => db.Post;
}> = {}) {
  const postIndex = useRef(0);
  const [posts, setPosts] = useState<db.Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(
    async ({
      limit = 10,
      simulateLoadMs = 200,
      insertionPoint = 'end',
      getPostAtOverride,
    }: Partial<{
      limit: number;
      simulateLoadMs: number;
      insertionPoint: 'start' | 'end';
      getPostAtOverride?: typeof getPostAt;
    }>) => {
      if (isLoading) {
        return;
      }
      setIsLoading(true);
      const page = range(postIndex.current, postIndex.current + limit).map(
        (i) => (getPostAtOverride ?? getPostAt)(i)
      );
      postIndex.current = postIndex.current + limit;
      await new Promise((resolve) => setTimeout(resolve, simulateLoadMs));
      setPosts((prev) =>
        insertionPoint === 'start' ? [...page, ...prev] : [...prev, ...page]
      );
      setIsLoading(false);
    },
    [isLoading, getPostAt, postIndex]
  );

  return {
    posts,
    loadMore,
    isLoading,
  };
}

function FixtureToolbar({
  children,
}: {
  children: (opts: {
    doBusyWork: (fn: () => Promise<void>) => Promise<void>;
  }) => React.ReactNode;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const doBusyWork = useCallback(async (fn: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await fn();
    } finally {
      setIsBusy(false);
    }
  }, []);

  return (
    <SafeAreaView
      style={{
        position: 'absolute',
        right: 10,
        top: 10,
      }}
    >
      <View
        style={{
          backgroundColor: 'hsla(0, 0%, 100%, 0.8)',
          borderColor: 'black',
          borderWidth: 1,
          borderRadius: 5,
          opacity: isBusy ? 0.5 : 1,
        }}
        pointerEvents={isBusy ? 'none' : 'auto'}
      >
        {children({ doBusyWork })}
      </View>
    </SafeAreaView>
  );
}

function ChannelWithControlledPostLoading() {
  const anchorPost = useMemo(() => createFakePost(), []);
  const { posts, loadMore, isLoading } = useSimulatedPostsQuery({
    getPostAt: useCallback(
      (index: number) => {
        // Insert anchor post near start, but enough to warrant scroll
        if (index === 8) {
          return anchorPost;
        }
        return createFakePost();
      },
      [anchorPost]
    ),
  });

  const [shouldLoadOnScrollBoundaries, setShouldLoadOnScrollBoundaries] =
    useState(false);
  const onScrollStartReached = useMemo(
    () =>
      shouldLoadOnScrollBoundaries
        ? () => loadMore({ limit: 5, insertionPoint: 'start' })
        : undefined,
    [shouldLoadOnScrollBoundaries, loadMore]
  );
  const onScrollEndReached = useMemo(
    () =>
      shouldLoadOnScrollBoundaries
        ? () => loadMore({ limit: 5, insertionPoint: 'end' })
        : undefined,
    [shouldLoadOnScrollBoundaries, loadMore]
  );

  return (
    <>
      <ChannelFixture
        negotiationMatch={true}
        theme={'light'}
        passedProps={(baseProps) => ({
          posts,
          isLoading,
          initialChannelUnread: createTestChannelUnread({
            channel: baseProps.channel,
            post: anchorPost,
          }),
          hasNewerPosts: true,
          onScrollStartReached,
          onScrollEndReached,
        })}
      />
      <FixtureToolbar>
        {({ doBusyWork }) => (
          <YStack>
            <XStack>
              <Label>Load on scroll boundaries</Label>
              <Switch
                value={shouldLoadOnScrollBoundaries}
                onValueChange={setShouldLoadOnScrollBoundaries}
              />
            </XStack>
            <Button
              title="Load older"
              onPress={() =>
                doBusyWork(() => loadMore({ limit: 10, insertionPoint: 'end' }))
              }
            />
            <Button
              title="Load newer"
              onPress={() =>
                doBusyWork(() =>
                  loadMore({ limit: 10, insertionPoint: 'start' })
                )
              }
            />
            <Button
              title="Load blitz"
              onPress={() => {
                doBusyWork(async () => {
                  for (let i = 0; i < 3; i++) {
                    await loadMore({
                      limit: 5,
                      insertionPoint: 'start',
                      simulateLoadMs: 30,
                    });
                    await loadMore({
                      limit: 5,
                      insertionPoint: 'end',
                      simulateLoadMs: 30,
                    });
                  }
                });
              }}
            />
            <Button
              title="Load around anchor"
              onPress={() => {
                // Simulate a `mode: around` query:
                // - First page has `limit` number of posts
                // - First page has anchor post at index `floor(limit / 2)`
                // - Subsequent pages alternate between inserting at start/end of timeline
                doBusyWork(async () => {
                  const limit = 5;
                  const getPostAtOverride = (index: number) => {
                    if (index === Math.floor(limit / 2)) {
                      return anchorPost;
                    }
                    return createFakePost();
                  };
                  for (let i = 0; i < 3; i++) {
                    await loadMore({
                      limit,
                      insertionPoint: 'start',
                      simulateLoadMs: 30,
                      getPostAtOverride,
                    });
                    await loadMore({
                      limit,
                      insertionPoint: 'end',
                      simulateLoadMs: 30,
                      getPostAtOverride,
                    });
                  }
                });
              }}
            />
          </YStack>
        )}
      </FixtureToolbar>
    </>
  );
}

function ConfigurableChannelFixture({
  initialContentConfiguration,
}: {
  initialContentConfiguration?: ChannelContentConfiguration;
}) {
  return (
    <ChannelFixture>
      {({ channel, setChannel }) => (
        <DebugChannelConfigurator
          {...{ channel, setChannel, initialContentConfiguration }}
        />
      )}
    </ChannelFixture>
  );
}

function DebugChannelConfigurator({
  channel,
  setChannel,
  initialContentConfiguration,
}: {
  channel: db.Channel;
  setChannel: (update: SetStateAction<db.Channel>) => void;
  initialContentConfiguration?: ChannelContentConfiguration;
}) {
  const [open, setOpen] = useState(false);

  const hasAppliedInitialConfig = useRef(false);
  useEffect(() => {
    if (!hasAppliedInitialConfig.current) {
      setChannel((prev) => ({
        ...prev,
        contentConfiguration:
          initialContentConfiguration ?? prev.contentConfiguration,
      }));
    }
    hasAppliedInitialConfig.current = true;
  }, [channel, initialContentConfiguration, setChannel]);

  return (
    <>
      <Sheet open={open} animation={'simple'} snapPointsMode="fit">
        <ChannelConfigurationBar
          channel={channel}
          onPressDone={() => setOpen(false)}
          updateChannelConfiguration={(update) => {
            setChannel((prev) => ({
              ...prev,
              contentConfiguration: update(
                prev.contentConfiguration ?? undefined
              ),
            }));
          }}
        />
      </Sheet>
      <View style={{ position: 'absolute', top: 50, right: 10 }}>
        <Button
          title="Toggle configurator"
          onPress={() => setOpen((x) => !x)}
        />
      </View>
    </>
  );
}

function createTestChannelUnread({
  channel,
  post,
}: {
  channel: db.Channel;
  post: db.Post;
}): db.ChannelUnread {
  return {
    channelId: channel.id,
    type: 'channel',
    notify: false,
    count: 1,
    countWithoutThreads: 1,
    updatedAt: post.sentAt,
    firstUnreadPostId: post.id,
  };
}

export default {
  chat: <ChannelFixture negotiationMatch={true} theme={'light'} />,
  emptyChat: (
    <ChannelFixture
      negotiationMatch={true}
      theme={'light'}
      passedProps={() => ({
        posts: [],
      })}
    />
  ),
  chatWithSimulatedLoad: <ChannelWithControlledPostLoading />,
  chatWithUnreadAnchor: (
    <ChannelFixture
      negotiationMatch={true}
      theme={'light'}
      passedProps={(baseProps) => ({
        initialChannelUnread: createTestChannelUnread({
          channel: baseProps.channel,
          post: baseProps.posts!.at(10)!,
        }),
      })}
    />
  ),
  gallery: <GalleryChannelFixture />,
  notebook: <NotebookChannelFixture />,
  negotiationMismatch: <ChannelFixture negotiationMatch={false} />,
  customChannel: (
    <ConfigurableChannelFixture
      initialContentConfiguration={{
        ...ChannelContentConfiguration.defaultConfiguration(),
        defaultPostCollectionRenderer: {
          id: CollectionRendererId.boardroom,
          configuration: {
            showAuthors: true,
          },
        },
      }}
    />
  ),
};
