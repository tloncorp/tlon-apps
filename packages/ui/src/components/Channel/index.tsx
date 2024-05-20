import {
  isChatChannel as getIsChatChannel,
  useChannel as useChannelFromStore,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import { UploadInfo } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  Block,
  JSONContent,
  Story,
  constructStory,
} from '@tloncorp/shared/dist/urbit';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { Add, ArrowUp } from '../../assets/icons';
import {
  CalmProvider,
  CalmState,
  ContactsProvider,
  GroupsProvider,
  NavigationProvider,
} from '../../contexts';
import { ReferencesProvider } from '../../contexts/references';
import { RequestsProvider } from '../../contexts/requests';
import { SizableText, Spinner, View, YStack } from '../../core';
import * as utils from '../../utils';
import AddGalleryPost from '../AddGalleryPost';
import { ChatMessage } from '../ChatMessage';
import { GalleryInput } from '../GalleryInput/index.native';
import { GalleryPost } from '../GalleryPost';
import { IconButton } from '../IconButton';
import { LoadingSpinner } from '../LoadingSpinner';
import { MessageInput } from '../MessageInput';
import { NotebookPost } from '../NotebookPost';
import { ChannelHeader } from './ChannelHeader';
import { EmptyChannelNotice } from './EmptyChannelNotice';
import Scroller, { ScrollAnchor } from './Scroller';
import UploadedImagePreview from './UploadedImagePreview';

//TODO implement usePost and useChannel
const useGroup = () => {};
const useApp = () => {};

export function Channel({
  channel,
  currentUserId,
  posts,
  selectedPostId,
  contacts,
  group,
  calmSettings,
  goBack,
  goToChannels,
  goToSearch,
  goToImageViewer,
  goToPost,
  messageSender,
  onScrollEndReached,
  onScrollStartReached,
  uploadInfo,
  isLoadingPosts,
  onPressRef,
  usePost,
  useChannel,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  negotiationMatch,
  hasNewerPosts,
  hasOlderPosts,
}: {
  channel: db.Channel;
  currentUserId: string;
  selectedPostId?: string;
  posts: db.Post[] | null;
  contacts: db.Contact[] | null;
  group: db.Group | null;
  calmSettings?: CalmState;
  goBack: () => void;
  goToChannels: () => void;
  goToPost: (post: db.Post) => void;
  goToImageViewer: (post: db.Post, imageUri?: string) => void;
  goToSearch: () => void;
  messageSender: (content: Story, channelId: string) => void;
  uploadInfo: UploadInfo;
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  isLoadingPosts?: boolean;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelFromStore;
  storeDraft: (draft: JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (post: db.Post, content: Story) => void;
  negotiationMatch: boolean;
  hasNewerPosts?: boolean;
  hasOlderPosts?: boolean;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const [showGalleryInput, setShowGalleryInput] = useState(false);
  const [showAddGalleryPost, setShowAddGalleryPost] = useState(false);
  const title = channel ? utils.getChannelTitle(channel) : '';
  const groups = useMemo(() => (group ? [group] : null), [group]);
  const canWrite = utils.useCanWrite(channel, currentUserId);

  const isChatChannel = channel ? getIsChatChannel(channel) : true;
  const renderItem =
    channel.type === 'chat'
      ? ChatMessage
      : channel.type === 'notebook'
        ? NotebookPost
        : GalleryPost;
  const renderEmptyComponent = useCallback(() => {
    return <EmptyChannelNotice channel={channel} userId={currentUserId} />;
  }, [currentUserId, channel]);

  const scrollerAnchor: ScrollAnchor | null = useMemo(() => {
    if (channel.type === 'notebook') {
      return null;
    } else if (selectedPostId) {
      return { type: 'selected', postId: selectedPostId };
    } else if (
      channel.unread?.countWithoutThreads &&
      channel.unread.firstUnreadPostId
    ) {
      return { type: 'unread', postId: channel.unread.firstUnreadPostId };
    }
    return null;
  }, [selectedPostId, channel]);

  const sendGalleryImagePost = useCallback(async () => {
    const story = constructStory([]);
    const blocks: Block[] = [];
    const uploadedImage = uploadInfo.uploadedImage;

    if (uploadedImage) {
      blocks.push({
        image: {
          src: uploadedImage.url,
          height: uploadedImage.height ? uploadedImage.height : 200,
          width: uploadedImage.width ? uploadedImage.width : 200,
          alt: 'image',
        },
      });
    }

    if (blocks && blocks.length > 0) {
      story.push(...blocks.map((block) => ({ block })));
    }

    await messageSender(story, channel.id);
  }, [uploadInfo.uploadedImage, channel.id, messageSender]);

  return (
    <CalmProvider calmSettings={calmSettings}>
      <GroupsProvider groups={groups}>
        <ContactsProvider contacts={contacts ?? null}>
          <RequestsProvider
            usePost={usePost}
            useChannel={useChannel}
            useGroup={useGroup}
            useApp={useApp}
          >
            <NavigationProvider onPressRef={onPressRef}>
              <ReferencesProvider>
                <YStack
                  justifyContent="space-between"
                  width="100%"
                  height="100%"
                >
                  <ChannelHeader
                    title={title}
                    goBack={goBack}
                    goToChannels={goToChannels}
                    goToSearch={goToSearch}
                    showPickerButton={!!group}
                    showSpinner={isLoadingPosts}
                  />
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flex: 1 }}
                  >
                    <YStack alignItems="center" flex={1}>
                      {showGalleryInput ? (
                        <GalleryInput
                          shouldBlur={inputShouldBlur}
                          setShouldBlur={setInputShouldBlur}
                          send={messageSender}
                          channelId={channel.id}
                          groupMembers={group?.members ?? []}
                          storeDraft={storeDraft}
                          clearDraft={clearDraft}
                          getDraft={getDraft}
                          editingPost={editingPost}
                          setEditingPost={setEditingPost}
                          editPost={editPost}
                          setShowGalleryInput={setShowGalleryInput}
                        />
                      ) : uploadInfo.imageAttachment ? (
                        <UploadedImagePreview
                          imageAttachment={uploadInfo.imageAttachment}
                          resetImageAttachment={uploadInfo.resetImageAttachment}
                        />
                      ) : (
                        <View flex={1}>
                          <View
                            position="absolute"
                            top={0}
                            left={0}
                            width="100%"
                            height="100%"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <LoadingSpinner />
                          </View>
                          {channel && posts && (
                            <Scroller
                              inverted={isChatChannel ? true : false}
                              renderItem={renderItem}
                              renderEmptyComponent={renderEmptyComponent}
                              currentUserId={currentUserId}
                              anchor={scrollerAnchor}
                              posts={posts}
                              hasNewerPosts={hasNewerPosts}
                              hasOlderPosts={hasOlderPosts}
                              editingPost={editingPost}
                              setEditingPost={setEditingPost}
                              editPost={editPost}
                              channelType={channel.type}
                              channelId={channel.id}
                              firstUnreadId={
                                channel.unread?.countWithoutThreads ?? 0 > 0
                                  ? channel.unread?.firstUnreadPostId
                                  : null
                              }
                              unreadCount={
                                channel.unread?.countWithoutThreads ?? 0
                              }
                              onPressReplies={goToPost}
                              onPressImage={goToImageViewer}
                              setInputShouldBlur={setInputShouldBlur}
                              onEndReached={onScrollEndReached}
                              onStartReached={onScrollStartReached}
                            />
                          )}
                        </View>
                      )}
                      {negotiationMatch &&
                        !editingPost &&
                        isChatChannel &&
                        canWrite && (
                          <MessageInput
                            shouldBlur={inputShouldBlur}
                            setShouldBlur={setInputShouldBlur}
                            send={messageSender}
                            channelId={channel.id}
                            uploadInfo={uploadInfo}
                            groupMembers={group?.members ?? []}
                            storeDraft={storeDraft}
                            clearDraft={clearDraft}
                            getDraft={getDraft}
                          />
                        )}
                      {!negotiationMatch && isChatChannel && canWrite && (
                        <NegotionMismatchNotice />
                      )}
                      {channel.type !== 'chat' &&
                        canWrite &&
                        !showGalleryInput && (
                          <View position="absolute" bottom="$l" right="$l">
                            {uploadInfo.uploadedImage &&
                            uploadInfo.uploading ? (
                              <View alignItems="center" padding="$m">
                                <Spinner />
                              </View>
                            ) : (
                              <IconButton
                                backgroundColor="$primaryText"
                                backgroundColorOnPress="$tertiaryText"
                                color="$background"
                                radius="$xl"
                                onPress={() =>
                                  uploadInfo.uploadedImage
                                    ? sendGalleryImagePost()
                                    : setShowAddGalleryPost(true)
                                }
                              >
                                {uploadInfo.uploadedImage ? (
                                  <ArrowUp />
                                ) : (
                                  <Add />
                                )}
                              </IconButton>
                            )}
                          </View>
                        )}
                      {channel.type === 'gallery' && canWrite && (
                        <AddGalleryPost
                          showAddGalleryPost={showAddGalleryPost}
                          setShowAddGalleryPost={setShowAddGalleryPost}
                          setShowGalleryInput={setShowGalleryInput}
                          setImage={uploadInfo.setAttachments}
                        />
                      )}
                    </YStack>
                  </KeyboardAvoidingView>
                </YStack>
              </ReferencesProvider>
            </NavigationProvider>
          </RequestsProvider>
        </ContactsProvider>
      </GroupsProvider>
    </CalmProvider>
  );
}

function NegotionMismatchNotice() {
  return (
    <View alignItems="center" justifyContent="center" padding="$l">
      <View
        backgroundColor="$secondaryBackground"
        borderRadius="$l"
        paddingHorizontal="$l"
        paddingVertical="$xl"
      >
        <SizableText size="$s">
          Your ship&apos;s version of the Tlon app doesn&apos;t match the
          channel host.
        </SizableText>
      </View>
    </View>
  );
}
