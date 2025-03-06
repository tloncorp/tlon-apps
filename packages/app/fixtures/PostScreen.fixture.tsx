import { range } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useValue } from 'react-cosmos/client';
import { SafeAreaView } from 'react-native';

import { PresentationalCarouselPostScreenContent } from '../features/top/PostScreen';
import {
  AppDataContextProvider,
  Button,
  PostScreenView,
  Text,
  View,
} from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePosts,
  createImageContent,
  group,
  initialContacts,
  tlonLocalBulletinBoard,
  tlonLocalIntros,
} from './fakeData';

const posts = createFakePosts(10);

let seed = 0;
function createImagePosts(count: number) {
  return range(count).map(
    () =>
      createFakePosts(1, 'block', {
        content: createImageContent(
          `https://picsum.photos/seed/s${seed++}/536/350`
        ),
      })[0]
  );
}

export default {
  PostScreenView: (
    <AppDataContextProvider
      contacts={initialContacts}
      calmSettings={{
        disableAvatars: false,
        disableNicknames: false,
        disableRemoteContent: false,
      }}
    >
      <FixtureWrapper fillWidth fillHeight>
        <PostScreenView
          handleGoToUserProfile={() => {}}
          isLoadingPosts={false}
          editPost={async () => {}}
          onPressRetry={async () => {}}
          onPressDelete={() => {}}
          editingPost={undefined}
          negotiationMatch={true}
          setEditingPost={() => {}}
          parentPost={null}
          channel={tlonLocalBulletinBoard}
          posts={posts}
          sendReply={async () => {}}
          markRead={() => {}}
          groupMembers={group.members ?? []}
          getDraft={async () => ({})}
          storeDraft={async () => {}}
          clearDraft={async () => {}}
          headerMode="default"
          onPressRef={() => {}}
          onGroupAction={() => {}}
          goToDm={() => {}}
        />
      </FixtureWrapper>
    </AppDataContextProvider>
  ),

  CarouselPostScreenContent() {
    const [hasNewerPosts] = useValue('Has newer posts', {
      defaultValue: true,
    });
    const [hasOlderPosts] = useValue('Has older posts', {
      defaultValue: true,
    });

    const [data, setData] = useState(() => ({
      channel: tlonLocalIntros,
      posts: createImagePosts(5),
    }));

    const pendingAction = useFixturePendingAction();

    return (
      <FixtureWrapper fillWidth fillHeight>
        <PresentationalCarouselPostScreenContent
          flex={1}
          width="100%"
          {...{
            initialPostIndex: 2,
            channel: data.channel,
            posts: data.posts,
            fetchNewerPage: useCallback(() => {
              if (!hasNewerPosts) {
                return;
              }

              pendingAction.queue({
                title: 'fetch newer',
                complete: () => {
                  setData((prev) => ({
                    ...prev,
                    posts: [...prev.posts, ...createImagePosts(5)],
                  }));
                },
              });
            }, [pendingAction, hasNewerPosts]),
            fetchOlderPage: useCallback(() => {
              if (!hasOlderPosts) {
                return;
              }
              pendingAction.queue({
                title: 'fetch older',
                complete: () => {
                  setData((prev) => ({
                    ...prev,
                    posts: [...createImagePosts(5), ...prev.posts],
                  }));
                },
              });
            }, [hasOlderPosts, pendingAction]),
          }}
        />
        {pendingAction.mountControl()}
      </FixtureWrapper>
    );
  },
};

/**
 * Use this to `queue()` an action, which will then be shown in the UI mounted
 * by `mountControl()` with a button to complete the action. (e.g. queue a
 * faked network call, manually interact with UI to get into a desired state,
 * then simulate the network call completing)
 */
function useFixturePendingAction() {
  const [pendingLoad, setPendingLoad] = useState<
    Array<{
      title: string;
      complete: () => void;
    }>
  >([]);

  return useMemo(
    () => ({
      queue: ({ title, complete }: { title: string; complete: () => void }) => {
        setPendingLoad((prev) => [...prev, { title, complete }]);
      },
      mountControl() {
        return (
          <SafeAreaView
            style={{
              position: 'absolute',
              alignSelf: 'center',
              padding: 8,
            }}
          >
            {pendingLoad.map((action, idx) => (
              <View key={idx}>
                <Text>{action.title}</Text>
                <Button
                  onPress={() => {
                    action.complete();
                    setPendingLoad((prev) => prev.filter((a) => a !== action));
                  }}
                >
                  <Text>Complete</Text>
                </Button>
                <Button
                  onPress={() => {
                    setPendingLoad((prev) => prev.filter((a) => a !== action));
                  }}
                >
                  <Text>Cancel</Text>
                </Button>
              </View>
            ))}
          </SafeAreaView>
        );
      },
    }),
    [pendingLoad]
  );
}
