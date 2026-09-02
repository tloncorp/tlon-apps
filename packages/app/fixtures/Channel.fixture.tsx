import type * as db from '@tloncorp/shared/db';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { range } from 'lodash';
import type { ComponentProps, PropsWithChildren, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView as UpstreamSafeAreaView,
} from 'react-native-safe-area-context';
import { Label, XStack, YStack } from 'tamagui';

import { ShipProvider } from '../contexts/ship';
import { AppDataContextProvider, Channel, ChatOptionsProvider } from '../ui';
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
const wrappingPostContent = JSON.stringify([
  {
    inline: [
      'I was just wondering what the stack is that actually makes an llm useful in one of the flagship interfaces',
    ],
  },
  {
    inline: [
      "it's not quite what we think of as a harness, that can present the thing as an 'agent'",
    ],
  },
  {
    inline: [
      'but it is a stack of stuff that can preserve context, memory and so on',
    ],
  },
  {
    inline: [
      "that's obvious, but I hadn't thought much about what it actually is",
    ],
  },
]);
const wrappingPost = createFakePost('chat', wrappingPostContent, undefined, {
  replyCount: 0,
});
const wrappingPosts = range(50).map(() =>
  createFakePost('chat', wrappingPostContent, undefined, { replyCount: 0 })
);

type UpstreamWrappingItem = {
  type: 'heading' | 'body';
  text: string;
};

// Exact content and layout preceding the deterministic failure in
// facebook/react-native#53450. Keep the order and copy unchanged: the bug is
// sensitive to width and vertical position.
const upstreamWrappingItems: UpstreamWrappingItem[] = [
  { type: 'heading', text: 'Lorem Ipsum' },
  { type: 'heading', text: 'Lorem Ipsum Dolor Sit Amet' },
  {
    type: 'body',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  },
  {
    type: 'body',
    text: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
  },
  {
    type: 'body',
    text: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
  },
  {
    type: 'body',
    text: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.',
  },
  { type: 'heading', text: 'Ut Enim Ad Minim Veniam' },
  {
    type: 'body',
    text: 'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.',
  },
  {
    type: 'body',
    text: 'Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.',
  },
  {
    type: 'body',
    text: 'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.',
  },
  {
    type: 'body',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  },
  {
    type: 'body',
    text: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  },
  { type: 'heading', text: 'Consectetur Adipiscing Elit' },
  {
    type: 'body',
    text: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
  },
  {
    type: 'body',
    text: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.',
  },
  {
    type: 'body',
    text: 'Consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit. This sentence is cut off.',
  },
  {
    type: 'body',
    text: 'Nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?',
  },
];

const upstreamWrappingStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ecf0f1' },
  textContainer: { marginBottom: 16, marginHorizontal: 16 },
  headingText: { fontWeight: 'bold', fontSize: 28 },
  text: { fontSize: 17, lineHeight: 24 },
});

function UpstreamTextWrappingRepro() {
  const listRef = useRef<FlatList<UpstreamWrappingItem>>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 1335, animated: false });
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <SafeAreaProvider style={upstreamWrappingStyles.container}>
        <UpstreamSafeAreaView style={upstreamWrappingStyles.container}>
          <FlatList
            ref={listRef}
            data={upstreamWrappingItems}
            initialNumToRender={upstreamWrappingItems.length}
            keyExtractor={(_, index) => String(index)}
            renderItem={({ item }) => (
              <View style={upstreamWrappingStyles.textContainer}>
                <Text
                  allowFontScaling={false}
                  style={
                    item.type === 'heading'
                      ? upstreamWrappingStyles.headingText
                      : upstreamWrappingStyles.text
                  }
                >
                  {item.text}
                </Text>
              </View>
            )}
            showsVerticalScrollIndicator
          />
        </UpstreamSafeAreaView>
      </SafeAreaProvider>
    </View>
  );
}
const notebookPosts = createFakePosts(5, 'note');
const onboardingCompletePost = createFakePost();
onboardingCompletePost.blob = appendToPostBlob(undefined, {
  type: 'tlon-agent-post-marker',
  version: 1,
  key: 'orientation-complete',
});

function noopProps<T extends object>() {
  return new Proxy<T>({} as unknown as T, {
    get: (_target, prop) => () => console.log(`${String(prop)} called`),
  });
}

const ChannelFixtureWrapper = ({
  children,
}: PropsWithChildren<{ theme?: 'light' | 'dark' }>) => {
  return (
    <ShipProvider
      initialShipInfo={{
        authType: 'hosted',
        ship: 'zod',
        shipUrl: 'https://zod.test',
        authCookie: 'fixture',
        needsSplashSequence: false,
      }}
    >
      <AppDataContextProvider currentUserId="~zod" contacts={initialContacts}>
        <FixtureWrapper fillWidth fillHeight>
          <ChatOptionsProvider {...noopProps()}>{children}</ChatOptionsProvider>
        </FixtureWrapper>
      </AppDataContextProvider>
    </ShipProvider>
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
  goToMediaViewer: () => {},
  goToUserProfile: () => {},
  goToGroupSettings: () => {},
  markRead: () => {},
  onPressRef: () => {},
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
  const onLoadNewerPosts = useMemo(
    () =>
      shouldLoadOnScrollBoundaries
        ? () => loadMore({ limit: 5, insertionPoint: 'start' })
        : undefined,
    [shouldLoadOnScrollBoundaries, loadMore]
  );
  const onLoadOlderPosts = useMemo(
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
          onLoadNewerPosts,
          onLoadOlderPosts,
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
  upstreamTextWrappingRepro: <UpstreamTextWrappingRepro />,
  chatMessageWrapping: (
    <ChannelFixture
      negotiationMatch={true}
      theme={'light'}
      passedProps={() => ({ posts: [wrappingPost] })}
    />
  ),
  chatMessageWrappingStress: (
    <ChannelFixture
      negotiationMatch={true}
      theme={'light'}
      passedProps={() => ({ posts: wrappingPosts })}
    />
  ),
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
  onboardingComplete: (
    <ChannelFixture
      negotiationMatch={true}
      theme={'light'}
      passedProps={() => ({
        posts: [onboardingCompletePost],
      })}
    />
  ),
  gallery: <GalleryChannelFixture />,
  notebook: <NotebookChannelFixture />,
  negotiationMismatch: <ChannelFixture negotiationMatch={false} />,
};
