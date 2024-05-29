import { isChatChannel as getIsChatChannel } from '@tloncorp/shared/dist';
import type * as api from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { Story } from '@tloncorp/shared/dist/urbit';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalmProvider, CalmState, ContactsProvider } from '../contexts';
import { ReferencesProvider } from '../contexts/references';
import { Text, View, YStack } from '../core';
import * as utils from '../utils';
import AuthorRow from './AuthorRow';
import { ChannelHeader } from './Channel/ChannelHeader';
import Scroller from './Channel/Scroller';
import UploadedImagePreview from './Channel/UploadedImagePreview';
import { ChatMessage } from './ChatMessage';
import CommentsScrollerSheet from './CommentsScrollerSheet';
import { GalleryPost } from './GalleryPost';
import { MessageInput } from './MessageInput';
import { NotebookPost } from './NotebookPost';

export function PostScreenView({
  currentUserId,
  contacts,
  channel,
  parentPost,
  posts,
  sendReply,
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
}: {
  currentUserId: string;
  calmSettings?: CalmState | null;
  contacts: db.Contact[] | null;
  channel: db.Channel;
  parentPost: db.Post | null;
  posts: db.Post[] | null;
  sendReply: (content: urbit.Story, channelId: string) => void;
  goBack?: () => void;
  groupMembers: db.ChatMember[];
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  uploadInfo: api.UploadInfo;
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (post: db.Post, content: Story) => void;
  negotiationMatch: boolean;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const canWrite = utils.useCanWrite(channel, currentUserId);
  const isChatChannel = channel ? getIsChatChannel(channel) : true;
  const postsWithoutParent = useMemo(
    () => posts?.filter((p) => p.id !== parentPost?.id) ?? [],
    [posts, parentPost]
  );

  const headerTitle = isChatChannel
    ? `Thread: ${channel?.title ?? null}`
    : parentPost?.title
      ? parentPost.title
      : `Post: ${channel?.title ?? null}`;

  const authorRowHeight = 48;

  const { bottom } = useSafeAreaInsets();

  return (
    <CalmProvider calmSettings={calmSettings}>
      <ContactsProvider contacts={contacts}>
        <ReferencesProvider>
          <View paddingBottom={bottom} backgroundColor="$background" flex={1}>
            <YStack flex={1} backgroundColor={'$background'}>
              <ChannelHeader
                title={headerTitle}
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
                {parentPost && channel.type === 'gallery' && (
                  <View paddingBottom={authorRowHeight}>
                    <GalleryPost
                      post={parentPost}
                      detailView
                      onPressImage={handleGoToImage}
                    />
                  </View>
                )}
                {parentPost && channel.type === 'notebook' && (
                  <View paddingBottom={authorRowHeight}>
                    <NotebookPost
                      post={parentPost}
                      detailView
                      onPressImage={handleGoToImage}
                    />
                  </View>
                )}
                {uploadInfo.imageAttachment ? (
                  <UploadedImagePreview
                    imageAttachment={uploadInfo.imageAttachment}
                    resetImageAttachment={uploadInfo.resetImageAttachment}
                  />
                ) : (
                  posts &&
                  // Delay rendering until replies have been loaded.
                  posts.length > 1 &&
                  channel &&
                  isChatChannel && (
                    <Scroller
                      setInputShouldBlur={setInputShouldBlur}
                      inverted
                      renderItem={ChatMessage}
                      channelType="chat"
                      channelId={channel.id}
                      currentUserId={currentUserId}
                      editingPost={editingPost}
                      setEditingPost={setEditingPost}
                      editPost={editPost}
                      posts={posts}
                      showReplies={false}
                      onPressImage={handleGoToImage}
                    />
                  )
                )}
                {parentPost && (
                  <CommentsScrollerSheet
                    open={showComments}
                    setOpen={setShowComments}
                    channelId={channel.id}
                    currentUserId={currentUserId}
                    editingPost={editingPost}
                    setEditingPost={setEditingPost}
                    editPost={editPost}
                    posts={postsWithoutParent}
                    parentPost={parentPost}
                    onPressImage={handleGoToImage}
                    sendReply={sendReply}
                    uploadInfo={uploadInfo}
                    groupMembers={groupMembers}
                    storeDraft={storeDraft}
                    clearDraft={clearDraft}
                    getDraft={getDraft}
                  />
                )}
                {negotiationMatch && !editingPost && channel && canWrite && (
                  <View
                    position={isChatChannel ? undefined : 'absolute'}
                    backgroundColor="$background"
                    bottom={0}
                    width="100%"
                  >
                    {isChatChannel ? (
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
                    ) : parentPost ? (
                      <AuthorRow
                        parentPost={parentPost}
                        setShowComments={setShowComments}
                        authorId={parentPost.authorId}
                        author={parentPost.author}
                        sent={parentPost.sentAt}
                      />
                    ) : null}
                  </View>
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
              </KeyboardAvoidingView>
            </YStack>
          </View>
        </ReferencesProvider>
      </ContactsProvider>
    </CalmProvider>
  );
}
