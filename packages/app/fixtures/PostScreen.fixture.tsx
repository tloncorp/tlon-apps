import { spyOn } from '@tloncorp/shared';
import * as baseStore from '@tloncorp/shared/store';
import { range } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useValue } from 'react-cosmos/client';
import { SafeAreaView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppDataContextProvider,
  Button,
  PostScreenView,
  StoreProvider,
  Text,
  View,
} from '../ui';
import { PresentationalCarouselPostScreenContent } from '../ui/components/PostScreenView';
import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePosts,
  createImageContent,
  group,
  initialContacts,
  tlonLocalBulletinBoard,
  tlonLocalCommunityCatalog,
} from './fakeData';

const noop = async (): Promise<void> => {};

let seed = 0;
function createImagePosts(count: number) {
  return range(count).map(
    () =>
      createFakePosts(1, 'chat', {
        content: createImageContent(
          `https://picsum.photos/seed/s${seed++}/536/350`
        ),
        channelId: tlonLocalCommunityCatalog.id,
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
          editPost={async () => {}}
          onPressRetry={async () => {}}
          onPressDelete={() => {}}
          editingPost={undefined}
          negotiationMatch={true}
          setEditingPost={() => {}}
          parentPost={null}
          channel={tlonLocalBulletinBoard}
          group={group}
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
      channel: tlonLocalCommunityCatalog,
      posts: createImagePosts(5),
    }));

    const pendingAction = useFixturePendingAction();

    const fetchNewerPage = useCallback(() => {
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
    }, [pendingAction, hasNewerPosts]);
    const fetchOlderPage = useCallback(() => {
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
    }, [hasOlderPosts, pendingAction]);

    const store = useMemo(() => {
      const fail = () => {
        throw new Error();
      };
      // `useChannelContext` is used deep in the post detail screen to
      // determine how to present the post.
      return spyOn(baseStore, 'useChannelContext', () => ({
        // @ts-expect-error - close enough
        group: data.channel.group,
        channel: data.channel,
        // @ts-expect-error - negotiationStatus is hard to stub
        negotiationStatus: 'todo',
        getDraft: fail,
        storeDraft: fail,
        clearDraft: fail,
        editingPost: undefined,
        setEditingPost: fail,
        editPost: fail,
      }));
    }, [data.channel]);

    const safeAreaInsets = useSafeAreaInsets();

    return (
      <StoreProvider stub={store}>
        <FixtureWrapper fillWidth fillHeight>
          <View
            height={100}
            paddingTop={safeAreaInsets.top}
            alignItems="center"
            justifyContent="center"
          >
            <Text>Header</Text>
          </View>
          <PresentationalCarouselPostScreenContent
            {...{
              flex: 1,
              width: '100%',
              initialPostIndex: 2,
              channel: data.channel,
              posts: data.posts,
              fetchNewerPage,
              fetchOlderPage,
              channelContext: {
                group: data.channel.group || null,
                editingPost: undefined,
                setEditingPost: undefined,
                editPost: noop,
                negotiationMatch: true,
                onPressRetry: undefined,
                onPressDelete: noop,
              },
            }}
          />
          {pendingAction.mountControl()}
        </FixtureWrapper>
      </StoreProvider>
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
