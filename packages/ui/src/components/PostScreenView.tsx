import { isChatChannel as getIsChatChannel } from '@tloncorp/shared/dist';
import type * as api from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { Story } from '@tloncorp/shared/dist/urbit';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDataContextProvider, CalmProvider, CalmState } from '../contexts';
import { ReferencesProvider } from '../contexts/references';
import { Text, View, YStack } from '../core';
import { useStickyUnread } from '../hooks/useStickyUnread';
import * as utils from '../utils';
import { ChannelFooter } from './Channel/ChannelFooter';
import { ChannelHeader } from './Channel/ChannelHeader';
import Scroller from './Channel/Scroller';
import UploadedImagePreview from './Channel/UploadedImagePreview';
import { ChatMessage } from './ChatMessage';
import { NotebookDetailView } from './DetailView';
import GalleryDetailView from './DetailView/GalleryDetailView';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { MessageInput } from './MessageInput';

export function PostScreenView({
  currentUserId,
  contacts,
  channel,
  parentPost,
  posts,
  sendReply,
  markRead,
  goBack,
  groupMembers,
  calmSettings,
  uploadInfo,
  handleGoToImage,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  negotiationMatch,
  headerMode,
}: {
  currentUserId: string;
  calmSettings?: CalmState | null;
  contacts: db.Contact[] | null;
  channel: db.Channel;
  group?: db.Group | null;
  parentPost: db.Post | null;
  posts: db.Post[] | null;
  sendReply: (content: urbit.Story, channelId: string) => Promise<void>;
  markRead: () => void;
  goBack?: () => void;
  groupMembers: db.ChatMember[];
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  uploadInfo: api.UploadInfo;
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (post: db.Post, content: Story) => Promise<void>;
  negotiationMatch: boolean;
  headerMode?: 'default' | 'next';
}) {
  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const canWrite = utils.useCanWrite(channel, currentUserId);
  const isChatChannel = channel ? getIsChatChannel(channel) : true;
  const threadUnread = useStickyUnread(parentPost?.threadUnread);
  const postsWithoutParent = useMemo(
    () => posts?.filter((p) => p.id !== parentPost?.id) ?? [],
    [posts, parentPost]
  );

  const { bottom } = useSafeAreaInsets();

  const headerTitle = isChatChannel
    ? `Thread: ${channel?.title ?? null}`
    : 'Post';

  const hasLoaded = !!(posts && channel && parentPost);
  useEffect(() => {
    if (hasLoaded) {
      markRead();
    }
    // Only want to trigger once per set of params
    // eslint-disable-next-line
  }, [hasLoaded]);

  return (
    <CalmProvider calmSettings={calmSettings}>
      <AppDataContextProvider contacts={contacts} currentUserId={currentUserId}>
        <ReferencesProvider>
          <View
            paddingBottom={isChatChannel ? bottom : 'unset'}
            backgroundColor="$background"
            flex={1}
          >
            <YStack flex={1} backgroundColor={'$background'}>
              <ChannelHeader
                channel={channel}
                group={channel.group}
                title={headerTitle}
                goBack={goBack}
                showSearchButton={false}
                showMenuButton={!isChatChannel}
                post={parentPost ?? undefined}
                channelType={channel.type}
                mode={headerMode}
              />
              <KeyboardAvoidingView enabled={!activeMessage}>
                {parentPost && channel.type === 'gallery' && (
                  <GalleryDetailView
                    post={parentPost}
                    onPressImage={handleGoToImage}
                    editingPost={editingPost}
                    setEditingPost={setEditingPost}
                    editPost={editPost}
                    posts={postsWithoutParent}
                    sendReply={sendReply}
                    groupMembers={groupMembers}
                    uploadInfo={uploadInfo}
                    storeDraft={storeDraft}
                    clearDraft={clearDraft}
                    getDraft={getDraft}
                    goBack={goBack}
                  />
                )}
                {parentPost && channel.type === 'notebook' && (
                  <NotebookDetailView
                    post={parentPost}
                    onPressImage={handleGoToImage}
                    editingPost={editingPost}
                    setEditingPost={setEditingPost}
                    editPost={editPost}
                    posts={postsWithoutParent}
                    sendReply={sendReply}
                    groupMembers={groupMembers}
                    uploadInfo={uploadInfo}
                    storeDraft={storeDraft}
                    clearDraft={clearDraft}
                    getDraft={getDraft}
                    goBack={goBack}
                  />
                )}
                {uploadInfo.imageAttachment ? (
                  <UploadedImagePreview
                    imageAttachment={uploadInfo.imageAttachment}
                    resetImageAttachment={uploadInfo.resetImageAttachment}
                  />
                ) : (
                  posts &&
                  channel &&
                  isChatChannel && (
                    <View flex={1}>
                      <Scroller
                        inverted
                        renderItem={ChatMessage}
                        channelType="chat"
                        channelId={channel.id}
                        editingPost={editingPost}
                        setEditingPost={setEditingPost}
                        editPost={editPost}
                        posts={posts}
                        showReplies={false}
                        onPressImage={handleGoToImage}
                        firstUnreadId={
                          threadUnread?.count ?? 0 > 0
                            ? threadUnread?.firstUnreadPostId
                            : null
                        }
                        unreadCount={threadUnread?.count ?? 0}
                        activeMessage={activeMessage}
                        setActiveMessage={setActiveMessage}
                      />
                    </View>
                  )
                )}
                {negotiationMatch &&
                  !editingPost &&
                  channel &&
                  canWrite &&
                  isChatChannel && (
                    <MessageInput
                      shouldBlur={inputShouldBlur}
                      setShouldBlur={setInputShouldBlur}
                      send={sendReply}
                      channelId={channel.id}
                      uploadInfo={uploadInfo}
                      groupMembers={groupMembers}
                      storeDraft={storeDraft}
                      clearDraft={clearDraft}
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
                      Your ship&apos;s version of the Tlon app doesn&apos;t
                      match the channel host.
                    </Text>
                  </View>
                )}
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
        </ReferencesProvider>
      </AppDataContextProvider>
    </CalmProvider>
  );
}
