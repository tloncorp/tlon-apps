import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannelWithRelations, usePostReference } from '@tloncorp/shared';
import { ChannelContentConfiguration } from '@tloncorp/shared';
import {
  ChannelProvider,
  ComponentsKitContextProvider,
  ConnectedPostView,
  DetailPostUsingContentConfiguration,
  PostCollectionContext,
  PostView,
} from '@tloncorp/ui';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'PostUsingContentConfiguration'
>;

const noop = (..._args: unknown[]) => {};

export function PostUsingContentConfigurationScreen({
  route: {
    params: { channelId, postId },
  },
  navigation,
}: Props) {
  const post = usePostReference({ channelId, postId }).data;
  const channel = useChannelWithRelations({ id: channelId }).data;

  if (!post || !channel) {
    return null;
  }

  // TODO: probably needs AttachmentProvider, NavigationProvider
  return (
    <ComponentsKitContextProvider>
      <ChannelProvider value={{ channel }}>
        <PostCollectionContext.Provider
          value={{
            channel,
            collectionConfiguration:
              channel.contentConfiguration == null
                ? undefined
                : ChannelContentConfiguration.defaultPostCollectionRenderer(
                    channel.contentConfiguration
                  ).configuration,
            editingPost: undefined,
            goToImageViewer: noop,
            goToPost: noop,
            hasNewerPosts: false,
            hasOlderPosts: false,
            headerMode: 'default',
            initialChannelUnread: undefined,
            onPressDelete: noop,
            onPressRetry: noop,
            onScrollEndReached: noop,
            onScrollStartReached: noop,
            posts: undefined,
            selectedPostId: undefined,
            setEditingPost: noop,
            LegacyPostView: PostView,
            PostView: ConnectedPostView,
          }}
        >
          <DetailPostUsingContentConfiguration
            post={post}
            navigateBack={() => navigation.goBack()}
            flex={1}
          />
        </PostCollectionContext.Provider>
      </ChannelProvider>
    </ComponentsKitContextProvider>
  );
}
