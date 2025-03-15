import { constructStory } from '@tloncorp/shared/urbit';
import { Block } from '@tloncorp/shared/urbit';
import { FloatingActionButton } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { ParentAgnosticKeyboardAvoidingView } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import AddGalleryPost from '../AddGalleryPost';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import GalleryImagePreview from '../Channel/GalleryImagePreview';
import { ScreenHeader } from '../ScreenHeader';
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
    draftInputRef,
    editingPost,
    getDraft,
    onPresentationModeChange,
    send,
    storeDraft,
    headerMode,
  } = draftInputContext;

  const safeAreaInsets = useSafeAreaInsets();
  const captionInputRef = useRef<TextInput>(null);
  const { resetAttachments, waitForAttachmentUploads } = useAttachmentContext();

  const [showBigInput, setShowBigInput] = useState(false);
  const [showAddGalleryPost, setShowAddGalleryPost] = useState(false);
  const [isUploadingGalleryImage, setIsUploadingGalleryImage] = useState(false);
  const [canPost, setCanPost] = useState(false);
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const isShowingImagePreview = !editingPost && isUploadingGalleryImage;
  const isEditingPost = editingPost != null;

  // Reset all gallery-related state
  const resetGalleryState = useCallback(() => {
    setIsUploadingGalleryImage(false);
    setCanPost(false);
    setCaption('');
    clearDraft('caption');
    resetAttachments([]);
  }, [clearDraft, resetAttachments]);

  // Handle image selection
  const handleGalleryImageSet = useCallback(
    (assets?: ImagePickerAsset[] | null) => {
      const hasAssets = !!assets;
      setIsUploadingGalleryImage(hasAssets);
      setCanPost(hasAssets);
    },
    []
  );

  // Load caption from draft when image is being uploaded
  useEffect(() => {
    if (!isUploadingGalleryImage) return;

    getDraft('caption').then((draft) => {
      if (!draft || typeof draft !== 'object' || !('content' in draft)) return;

      const text = draft.content?.[0]?.content?.[0]?.text || '';
      setCaption(text);
    });
  }, [isUploadingGalleryImage, getDraft]);

  // Store caption in draft when it changes
  useEffect(() => {
    if (!isUploadingGalleryImage || !caption) return;

    const jsonContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: caption }],
        },
      ],
    };
    storeDraft(jsonContent, 'caption');
  }, [caption, isUploadingGalleryImage, storeDraft]);

  // Use big input when editing a post
  useEffect(() => {
    setShowBigInput(isEditingPost);
  }, [isEditingPost]);

  // Notify host when changing presentation mode
  useEffect(() => {
    const isFullscreen = showBigInput || isShowingImagePreview;
    onPresentationModeChange?.(isFullscreen ? 'fullscreen' : 'inline');
  }, [showBigInput, isShowingImagePreview, onPresentationModeChange]);

  // Handle posting the gallery image
  const handlePost = useCallback(async () => {
    if (isPosting) return;

    try {
      setIsPosting(true);

      // Wait for image attachments to finish uploading
      const finalAttachments = await waitForAttachmentUploads();

      // Filter for image attachments with completed uploads
      const imageAttachments = finalAttachments.filter(
        (attachment) =>
          attachment.type === 'image' &&
          'uploadState' in attachment &&
          attachment.uploadState &&
          (attachment.uploadState.status === 'complete' ||
            attachment.uploadState.status === 'success') &&
          'remoteUri' in attachment.uploadState &&
          attachment.uploadState.remoteUri
      );

      if (imageAttachments.length === 0) {
        console.error('No image attachments found for gallery post');
        setIsPosting(false);
        return;
      }

      // Create a story with the caption and image blocks
      const story = constructStory([caption || '']);

      // Extract and add image blocks to the story
      const blocks = imageAttachments.map((attachment) => {
        const imageAttachment = attachment as {
          type: 'image';
          file: ImagePickerAsset;
          uploadState: { remoteUri: string };
        };

        return {
          image: {
            src: imageAttachment.uploadState.remoteUri,
            height: imageAttachment.file.height,
            width: imageAttachment.file.width,
            alt: 'image',
          },
        } as Block;
      });

      story.push(...blocks.map((block) => ({ block })));

      // Create metadata with the first image
      const metadata: Record<string, any> = {};
      if (imageAttachments[0]) {
        const firstImage = imageAttachments[0] as {
          uploadState: { remoteUri: string };
        };
        metadata.image = firstImage.uploadState.remoteUri;
      }

      // Send the post and reset state
      await send(story, channel.id, metadata);
      resetGalleryState();

      // Reset posting state after a short delay
      setTimeout(() => setIsPosting(false), 500);
    } catch (error) {
      console.error('Error posting gallery image:', error);
      setIsPosting(false);
    }
  }, [
    caption,
    isPosting,
    send,
    channel.id,
    waitForAttachmentUploads,
    resetGalleryState,
  ]);

  // Register the "Add" button in the header
  useRegisterChannelHeaderItem(
    useMemo(
      () =>
        showBigInput || isShowingImagePreview ? null : (
          <ScreenHeader.IconButton
            key="gallery"
            type="Add"
            onPress={() => setShowAddGalleryPost(true)}
          />
        ),
      [showBigInput, isShowingImagePreview]
    )
  );

  // Register the "Post" button in the header when showing image preview
  useRegisterChannelHeaderItem(
    useMemo(
      () =>
        isShowingImagePreview ? (
          <ScreenHeader.TextButton
            key="gallery-preview-post"
            onPress={handlePost}
            disabled={!canPost || isPosting}
            testID="GalleryPostButton"
          >
            {isPosting ? 'Posting...' : 'Post'}
          </ScreenHeader.TextButton>
        ) : null,
      [isShowingImagePreview, handlePost, canPost, isPosting]
    )
  );

  // Expose methods to parent component
  useImperativeHandle(
    draftInputRef,
    () => ({
      exitFullscreen: () => {
        isShowingImagePreview ? resetGalleryState() : setShowBigInput(false);
      },
      startDraft: () => setShowAddGalleryPost(true),
    }),
    [isShowingImagePreview, resetGalleryState]
  );

  return (
    <>
      {/* Big input for editing */}
      <DraftInputConnectedBigInput
        draftInputContext={draftInputContext}
        setShowBigInput={setShowBigInput}
        hidden={!showBigInput}
        overrideChannelType="gallery"
      />

      {/* Floating action button */}
      {headerMode === 'next' &&
        !showBigInput &&
        !showAddGalleryPost &&
        !isUploadingGalleryImage && (
          <View
            position="absolute"
            bottom={safeAreaInsets.bottom}
            flex={1}
            width="100%"
            alignItems="center"
          >
            <FloatingActionButton
              onPress={() => setShowAddGalleryPost(true)}
              icon={<Icon type="Add" size={'$m'} />}
            />
          </View>
        )}

      {/* Image preview and caption input */}
      {isShowingImagePreview && (
        <YStack
          alignItems="stretch"
          flex={1}
          width={'100%'}
          bottom={safeAreaInsets.bottom}
        >
          <ParentAgnosticKeyboardAvoidingView
            contentContainerStyle={{ flex: 1, paddingTop: 32 }}
          >
            <GalleryImagePreview />
            <View padding="$l">
              <View
                backgroundColor="$background"
                padding="$m"
                borderWidth={1}
                borderRadius="$xl"
                borderColor="$border"
              >
                <TextInput
                  ref={captionInputRef}
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Add a caption..."
                  multiline
                  style={{
                    padding: 0,
                    fontSize: 16,
                    maxHeight: 100,
                  }}
                />
              </View>
            </View>
          </ParentAgnosticKeyboardAvoidingView>
        </YStack>
      )}

      {/* Add gallery post sheet */}
      <AddGalleryPost
        showAddGalleryPost={showAddGalleryPost}
        setShowAddGalleryPost={setShowAddGalleryPost}
        setShowGalleryInput={setShowBigInput}
        onSetImage={handleGalleryImageSet}
      />
    </>
  );
}
