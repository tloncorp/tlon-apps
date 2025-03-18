import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannel, usePostWithRelations } from '@tloncorp/shared';
import { ChannelContentConfiguration } from '@tloncorp/shared';

import type { RootStackParamList } from '../../navigation/types';
import {
  ChannelProvider,
  ChatOptionsProvider,
  ConnectedPostView,
  DetailPostUsingContentConfiguration,
  PostCollectionContext,
  PostView,
} from '../../ui';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'PostUsingContentConfiguration'
>;

const noop = (..._args: unknown[]) => {};
const asyncNoop = async (..._args: unknown[]) => {};

export function PostUsingContentConfigurationScreen({
  route: {
    params: { channelId, postId },
  },
  navigation,
}: Props) {
  const post = usePostWithRelations({ id: postId }).data;
  const channel = useChannel({ id: channelId }).data;

  if (!post || !channel) {
    return null;
  }

  // TODO: probably needs AttachmentProvider, NavigationProvider
  return (
    <ChatOptionsProvider
      onPressChannelTemplate={noop}
      onPressGroupMeta={noop}
      onPressGroupMembers={noop}
      onPressManageChannels={noop}
      onPressGroupPrivacy={noop}
      onPressChannelMembers={noop}
      onPressChannelMeta={noop}
      onPressRoles={noop}
      onPressChatDetails={noop}
    >
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
            isLoadingPosts: false,
            onPressDelete: noop,
            onPressRetry: asyncNoop,
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
    </ChatOptionsProvider>
  );
}
