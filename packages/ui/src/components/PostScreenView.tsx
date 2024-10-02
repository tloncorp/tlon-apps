import { isChatChannel as getIsChatChannel } from '@tloncorp/shared/dist';
import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { Story } from '@tloncorp/shared/dist/urbit';
import { ImagePickerAsset } from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { NavigationProvider, useCurrentUserId } from '../contexts';
import { AttachmentProvider } from '../contexts/attachment';
import * as utils from '../utils';
import { BigInput } from './BigInput';
import { ChannelFooter } from './Channel/ChannelFooter';
import { ChannelHeader } from './Channel/ChannelHeader';
import { DetailView } from './DetailView';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { MessageInput } from './MessageInput';

export function PostScreenView({
  channel,
  initialThreadUnread,
  parentPost,
  posts,
  sendReply,
  markRead,
  goBack,
  groupMembers,
  uploadAsset,
  handleGoToImage,
  handleGoToUserProfile,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  onPressRetry,
  onPressDelete,
  negotiationMatch,
  headerMode,
  canUpload,
}: {
  channel: db.Channel;
  initialThreadUnread?: db.ThreadUnreadState | null;
  group?: db.Group | null;
  parentPost: db.Post | null;
  posts: db.Post[] | null;
  sendReply: (content: urbit.Story, channelId: string) => Promise<void>;
  markRead: () => void;
  goBack?: () => void;
  groupMembers: db.ChatMember[];
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  handleGoToUserProfile: (userId: string) => void;
  uploadAsset: (asset: ImagePickerAsset) => Promise<void>;
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (
    post: db.Post,
    content: Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  negotiationMatch: boolean;
  headerMode: 'default' | 'next';
  canUpload: boolean;
}) {
  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const currentUserId = useCurrentUserId();
  const canWrite = utils.useCanWrite(channel, currentUserId);
  const isChatChannel = channel ? getIsChatChannel(channel) : true;
  const postsWithoutParent = useMemo(
    () => posts?.filter((p) => p.id !== parentPost?.id) ?? [],
    [posts, parentPost]
  );

  const { bottom } = useSafeAreaInsets();

  const headerTitle = isChatChannel
    ? `Thread: ${channel?.title ?? null}`
    : parentPost?.title ?? 'Post';

  const hasLoaded = !!(posts && channel && parentPost);
  useEffect(() => {
    if (hasLoaded) {
      markRead();
    }
    // Only want to trigger once per set of params
    // eslint-disable-next-line
  }, [hasLoaded]);

  const isEditingParent = useMemo(() => {
    return editingPost && editingPost.id === parentPost?.id;
  }, [editingPost, parentPost]);

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <NavigationProvider onGoToUserProfile={handleGoToUserProfile}>
        <View paddingBottom={bottom} backgroundColor="$background" flex={1}>
          <YStack flex={1} backgroundColor={'$background'}>
            <ChannelHeader
              channel={channel}
              group={channel.group}
              title={headerTitle}
              goBack={goBack}
              showSearchButton={false}
              post={parentPost ?? undefined}
              mode={headerMode}
            />
            <KeyboardAvoidingView enabled={!activeMessage}>
              {parentPost ? (
                <DetailView
                  post={parentPost}
                  channel={channel}
                  initialPostUnread={initialThreadUnread}
                  onPressImage={handleGoToImage}
                  editingPost={editingPost}
                  setEditingPost={setEditingPost}
                  editPost={editPost}
                  onPressRetry={onPressRetry}
                  onPressDelete={onPressDelete}
                  posts={postsWithoutParent}
                  goBack={goBack}
                  activeMessage={activeMessage}
                  setActiveMessage={setActiveMessage}
                  headerMode={headerMode}
                />
              ) : null}

              {negotiationMatch && !editingPost && channel && canWrite && (
                <MessageInput
                  placeholder="Reply"
                  shouldBlur={inputShouldBlur}
                  setShouldBlur={setInputShouldBlur}
                  send={sendReply}
                  channelId={channel.id}
                  groupMembers={groupMembers}
                  storeDraft={storeDraft}
                  clearDraft={clearDraft}
                  channelType="chat"
                  getDraft={getDraft}
                />
              )}
              {!negotiationMatch && channel && canWrite && (
                <View
                  position={isChatChannel ? undefined : 'absolute'}
                  bottom={0}
                  width="90%"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="$secondaryBackground"
                  borderRadius="$xl"
                  padding="$l"
                >
                  <Text>
                    Your ship&apos;s version of the Tlon app doesn&apos;t match
                    the channel host.
                  </Text>
                </View>
              )}

              {parentPost &&
              isEditingParent &&
              (channel.type === 'notebook' || channel.type === 'gallery') ? (
                <BigInput
                  channelType={urbit.getChannelType(parentPost.channelId)}
                  channelId={parentPost?.channelId}
                  editingPost={editingPost}
                  setEditingPost={setEditingPost}
                  editPost={editPost}
                  shouldBlur={inputShouldBlur}
                  setShouldBlur={setInputShouldBlur}
                  send={async () => {}}
                  getDraft={getDraft}
                  storeDraft={storeDraft}
                  clearDraft={clearDraft}
                  groupMembers={groupMembers}
                />
              ) : null}
              {headerMode === 'next' && (
                <ChannelFooter
                  showSearchButton={false}
                  title={'Thread: ' + channel.title}
                  goBack={goBack}
                />
              )}
            </KeyboardAvoidingView>
          </YStack>
        </View>
      </NavigationProvider>
    </AttachmentProvider>
  );
}
