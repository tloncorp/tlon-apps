import type * as db from '@tloncorp/shared/dist/db';
import { MessageInput, View, YStack } from '@tloncorp/ui';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { ChannelHeader } from './Channel/ChannelHeader';
import ChatScroll from './Channel/ChatScroll';

export function PostScreenView({
  channel,
  posts,
  goBack,
}: {
  channel: db.Channel | null;
  posts: db.PostWithRelations[] | null;
  goBack?: () => void;
}) {
  return (
    <YStack flex={1} backgroundColor={'$background'}>
      <ChannelHeader
        title={'Thread: ' + channel?.title ?? null}
        goBack={goBack}
        showPickerButton={false}
        showSearchButton={false}
      />
      <KeyboardAvoidingView
        //TODO: Standardize this component, account for tab bar in a better way
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={70}
        style={{ flex: 1 }}
      >
        {posts && <ChatScroll posts={posts} showReplies={false} />}
        {channel && (
          // Interaction disabled for now, will implement whatever blur solution
          // we end up with.
          <View pointerEvents="none">
            <MessageInput
              shouldBlur={false}
              setShouldBlur={() => {}}
              send={() => {}}
              channelId={channel.id}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </YStack>
  );
}
