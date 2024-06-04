import {
  isChatChannel as getIsChatChannel,
  useChannel as useChannelFromStore,
  useGroupPreview,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import { UploadInfo } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence, getToken } from 'tamagui';

import {
  CalmProvider,
  CalmState,
  ChannelProvider,
  ContactsProvider,
  GroupsProvider,
  NavigationProvider,
} from '../../contexts';
import { ReferencesProvider } from '../../contexts/references';
import { RequestsProvider } from '../../contexts/requests';
import { SizableText, View, YStack } from '../../core';
import * as utils from '../../utils';
import AddGalleryPost from '../AddGalleryPost';
import { BigInput } from '../BigInput';
import { ChatMessage } from '../ChatMessage';
import FloatingActionButton from '../FloatingActionButton';
import { GalleryPost } from '../GalleryPost';
import { GroupPreviewSheet } from '../GroupPreviewSheet';
import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';
import { MessageInput } from '../MessageInput';
import { navHeight } from '../NavBar/NavBar';
import { NotebookPost } from '../NotebookPost';
import { ChannelHeader } from './ChannelHeader';
import { DmInviteOptions } from './DmInviteOptions';
import { EmptyChannelNotice } from './EmptyChannelNotice';
import Scroller, { ScrollAnchor } from './Scroller';
import UploadedImagePreview from './UploadedImagePreview';

//TODO implement usePost and useChannel
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
  markRead,
  onPressRef,
  usePost,
  useGroup,
  onGroupAction,
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
  calmSettings?: CalmState | null;
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
  markRead: (post: db.Post) => void;
  usePost: typeof usePostWithRelations;
  useGroup: typeof useGroupPreview;
  onGroupAction: (action: string, group: db.Group) => void;
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
  const [showBigInput, setShowBigInput] = useState(false);
  const [showAddGalleryPost, setShowAddGalleryPost] = useState(false);
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);
  const title = channel ? utils.getChannelTitle(channel) : '';
  const groups = useMemo(() => (group ? [group] : null), [group]);
  const canWrite = utils.useCanWrite(channel, currentUserId);

  const isChatChannel = channel ? getIsChatChannel(channel) : true;
  const renderItem = isChatChannel
    ? ChatMessage
    : channel.type === 'notebook'
      ? NotebookPost
      : GalleryPost;
  const renderEmptyComponent = useCallback(() => {
    return <EmptyChannelNotice channel={channel} userId={currentUserId} />;
  }, [currentUserId, channel]);

  const onPressGroupRef = useCallback((group: db.Group) => {
    setGroupPreview(group);
  }, []);

  const handleGroupAction = useCallback(
    (action: string, group: db.Group) => {
      onGroupAction(action, group);
      setGroupPreview(null);
    },
    [onGroupAction]
  );

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

  const bigInputGoBack = () => {
    setShowBigInput(false);
    uploadInfo.resetImageAttachment();
  };

  const { bottom } = useSafeAreaInsets();

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
            <ChannelProvider value={{ channel }}>
              <NavigationProvider
                onPressRef={onPressRef}
                onPressGroupRef={onPressGroupRef}
              >
                <ReferencesProvider>
                  <View
                    paddingBottom={bottom}
                    backgroundColor="$background"
                    flex={1}
                  >
                    <YStack
                      justifyContent="space-between"
                      width="100%"
                      height="100%"
                    >
                      <ChannelHeader
                        title={title}
                        goBack={() =>
                          showBigInput ? bigInputGoBack() : goBack()
                        }
                        goToChannels={goToChannels}
                        goToSearch={goToSearch}
                        showPickerButton={!!group}
                        showSpinner={isLoadingPosts}
                      />
                      <KeyboardAvoidingView
                        behavior={
                          Platform.OS === 'ios' ? 'padding' : 'position'
                        }
                        style={{ flex: 1 }}
                        contentContainerStyle={{ flex: 1 }}
                      >
                        <YStack alignItems="center" flex={1}>
                          <AnimatePresence>
                            {showBigInput ? (
                              <View
                                key="big-input"
                                animation="simple"
                                enterStyle={{
                                  y: 100,
                                  opacity: 0,
                                }}
                                exitStyle={{
                                  y: 100,
                                  opacity: 0,
                                }}
                                y={0}
                                opacity={1}
                                width="100%"
                              >
                                <BigInput
                                  channelType={channel.type}
                                  channelId={channel.id}
                                  groupMembers={group?.members ?? []}
                                  shouldBlur={inputShouldBlur}
                                  setShouldBlur={setInputShouldBlur}
                                  send={messageSender}
                                  storeDraft={storeDraft}
                                  clearDraft={clearDraft}
                                  getDraft={getDraft}
                                  editingPost={editingPost}
                                  setEditingPost={setEditingPost}
                                  editPost={editPost}
                                  setShowBigInput={setShowBigInput}
                                  placeholder=""
                                  uploadInfo={uploadInfo}
                                />
                              </View>
                            ) : uploadInfo.imageAttachment &&
                              channel.type !== 'notebook' ? (
                              <UploadedImagePreview
                                imageAttachment={uploadInfo.imageAttachment}
                                resetImageAttachment={
                                  uploadInfo.resetImageAttachment
                                }
                              />
                            ) : (
                              <View flex={1} width="100%">
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
                                      channel.unread?.countWithoutThreads ??
                                      0 > 0
                                        ? channel.unread?.firstUnreadPostId
                                        : null
                                    }
                                    unreadCount={
                                      channel.unread?.countWithoutThreads ?? 0
                                    }
                                    onPressPost={goToPost}
                                    onPressReplies={goToPost}
                                    onPressImage={goToImageViewer}
                                    setInputShouldBlur={setInputShouldBlur}
                                    onEndReached={onScrollEndReached}
                                    onStartReached={onScrollStartReached}
                                  />
                                )}
                              </View>
                            )}
                          </AnimatePresence>
                          {negotiationMatch &&
                            !editingPost &&
                            (isChatChannel ||
                              (channel.type === 'gallery' &&
                                uploadInfo?.uploadedImage)) &&
                            canWrite && (
                              <MessageInput
                                shouldBlur={inputShouldBlur}
                                setShouldBlur={setInputShouldBlur}
                                send={messageSender}
                                channelId={channel.id}
                                uploadInfo={
                                  channel.type === 'notebook'
                                    ? undefined
                                    : uploadInfo
                                }
                                groupMembers={group?.members ?? []}
                                storeDraft={storeDraft}
                                clearDraft={clearDraft}
                                getDraft={getDraft}
                                editingPost={editingPost}
                                setEditingPost={setEditingPost}
                                editPost={editPost}
                                floatingActionButton={
                                  channel.type === 'gallery'
                                }
                                showAttachmentButton={
                                  channel.type !== 'gallery'
                                }
                                backgroundColor="$secondaryBackground"
                              />
                            )}
                          {!isChatChannel && canWrite && !showBigInput && (
                            <View
                              position="absolute"
                              bottom={
                                Platform.OS === 'ios'
                                  ? navHeight
                                  : bottom + getToken('$m')
                              }
                              flex={1}
                              width="100%"
                              alignItems="center"
                            >
                              {(channel.type === 'gallery' &&
                                showAddGalleryPost) ||
                              uploadInfo.imageAttachment ? null : (
                                <FloatingActionButton
                                  onPress={() =>
                                    channel.type === 'gallery'
                                      ? setShowAddGalleryPost(true)
                                      : setShowBigInput(true)
                                  }
                                  label="New Post"
                                  icon={
                                    <Icon
                                      type="Add"
                                      size={'$s'}
                                      marginRight={'$s'}
                                    />
                                  }
                                />
                              )}
                            </View>
                          )}
                          {!negotiationMatch && isChatChannel && canWrite && (
                            <NegotionMismatchNotice />
                          )}
                          {channel.isDmInvite && (
                            <DmInviteOptions
                              channel={channel}
                              goBack={goBack}
                            />
                          )}
                          {!negotiationMatch && isChatChannel && canWrite && (
                            <NegotionMismatchNotice />
                          )}
                          {channel.type === 'gallery' && canWrite && (
                            <AddGalleryPost
                              showAddGalleryPost={showAddGalleryPost}
                              setShowAddGalleryPost={setShowAddGalleryPost}
                              setShowGalleryInput={setShowBigInput}
                              setImage={uploadInfo.setAttachments}
                            />
                          )}
                        </YStack>
                      </KeyboardAvoidingView>
                      <GroupPreviewSheet
                        group={groupPreview ?? undefined}
                        open={!!groupPreview}
                        onOpenChange={() => setGroupPreview(null)}
                        onActionComplete={handleGroupAction}
                      />
                    </YStack>
                  </View>
                </ReferencesProvider>
              </NavigationProvider>
            </ChannelProvider>
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
