import {
  isChatChannel as getIsChatChannel,
  useChannel as useChannelFromStore,
  useGroupPreview,
  usePostReference as usePostReferenceHook,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence, SizableText, View, YStack } from 'tamagui';

import AddGalleryPost from '../AddGalleryPost';
import GalleryImagePreview from '../Channel/GalleryImagePreview';
import { FloatingActionButton } from '../FloatingActionButton';
import { Icon } from '../Icon';
import { MessageInput } from '../MessageInput';
import { ParentAgnosticKeyboardAvoidingView } from '../ParentAgnosticKeyboardAvoidingView';
import { DraftInputConnectedBigInput } from './DraftInputConnectedBigInput';
import { DraftInputContext } from './shared';

export function GalleryInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const {
    channel,
    clearDraft,
    editPost,
    editingPost,
    getDraft,
    group,
    onPresentationModeChange,
    send,
    setEditingPost,
    setShouldBlur,
    shouldBlur,
    storeDraft,
  } = draftInputContext;
  const safeAreaInsets = useSafeAreaInsets();

  const [showBigInput, setShowBigInput] = useState(false);
  const [showAddGalleryPost, setShowAddGalleryPost] = useState(false);
  const [isUploadingGalleryImage, setIsUploadingGalleryImage] = useState(false);

  const handleGalleryPreviewClosed = useCallback(() => {
    setIsUploadingGalleryImage(false);
  }, []);
  const handleGalleryImageSet = useCallback(
    (assets?: ImagePickerAsset[] | null) => {
      setIsUploadingGalleryImage(!!assets);
    },
    []
  );

  const isShowingImagePreview = !editingPost && isUploadingGalleryImage;

  // Notify host when changing presentation mode
  useEffect(() => {
    const isFullscreen = showBigInput || isShowingImagePreview;
    onPresentationModeChange?.(isFullscreen ? 'fullscreen' : 'inline');
  }, [showBigInput, isShowingImagePreview, onPresentationModeChange]);

  // Use big input when editing a post
  const isEditingPost = editingPost != null;
  useEffect(() => {
    setShowBigInput(isEditingPost);
  }, [isEditingPost]);

  return (
    <>
      <AnimatePresence>
        {showBigInput && (
          <DraftInputConnectedBigInput
            draftInputContext={draftInputContext}
            setShowBigInput={setShowBigInput}
          />
        )}
      </AnimatePresence>

      {!showBigInput && !showAddGalleryPost && !isUploadingGalleryImage && (
        <View
          position="absolute"
          bottom={safeAreaInsets.bottom}
          flex={1}
          width="100%"
          alignItems="center"
        >
          <FloatingActionButton
            onPress={() => setShowAddGalleryPost(true)}
            icon={<Icon type="Add" size={'$s'} marginRight={'$s'} />}
          />
        </View>
      )}

      {isShowingImagePreview && (
        <YStack
          alignItems="stretch"
          flex={1}
          width={'100%'}
          bottom={safeAreaInsets.bottom}
        >
          <ParentAgnosticKeyboardAvoidingView
            contentContainerStyle={{ flex: 1 }}
          >
            <GalleryImagePreview onReset={handleGalleryPreviewClosed} />
            <MessageInput
              shouldBlur={shouldBlur}
              setShouldBlur={setShouldBlur}
              send={send}
              channelId={channel.id}
              groupMembers={group?.members ?? []}
              storeDraft={storeDraft}
              clearDraft={clearDraft}
              getDraft={getDraft}
              editingPost={editingPost}
              setEditingPost={setEditingPost}
              editPost={editPost}
              channelType={channel.type}
              onSend={() => {
                setIsUploadingGalleryImage(false);
              }}
              showInlineAttachments={false}
              showAttachmentButton={false}
            />
          </ParentAgnosticKeyboardAvoidingView>
        </YStack>
      )}

      <AddGalleryPost
        showAddGalleryPost={showAddGalleryPost}
        setShowAddGalleryPost={setShowAddGalleryPost}
        setShowGalleryInput={setShowBigInput}
        onSetImage={handleGalleryImageSet}
      />
    </>
  );
}
