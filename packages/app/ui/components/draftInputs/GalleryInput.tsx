import { extractContentTypesFromPost } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import { Block, constructStory } from '@tloncorp/shared/urbit';
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
import { View, YStack, useTheme } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import AddGalleryPost from '../AddGalleryPost';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import GalleryImagePreview from '../Channel/GalleryImagePreview';
import { ScreenHeader } from '../ScreenHeader';
import Notices from '../Wayfinding/Notices';
import { DraftInputConnectedBigInput } from './DraftInputConnectedBigInput';
import { LinkInput, LinkInputSaveParams } from './LinkInput';
import { DraftInputContext, GalleryRoute } from './shared';

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
    sendPost,
    storeDraft,
    editPost,
    setEditingPost,
  } = draftInputContext;

  const safeAreaInsets = useSafeAreaInsets();
  const captionInputRef = useRef<TextInput>(null);
  const {
    resetAttachments,
    waitForAttachmentUploads,
    addAttachment,
    attachAssets,
  } = useAttachmentContext();
  const theme = useTheme();

  const [route, setRoute] = useState<GalleryRoute>('gallery');
  const [canPost, setCanPost] = useState(false);
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const isEditingPost = editingPost != null;

  // Determine if the editing post is an image gallery post or text gallery post
  // This effect runs when an editingPost is provided and sets up the appropriate editing UI
  useEffect(() => {
    if (!editingPost) return;

    try {
      const { blocks } = extractContentTypesFromPost(editingPost);

      // Check if the first block is an image - if so, it's an image gallery post
      if (blocks.length > 0) {
        setRoute('image');

        // Extract caption from the post if it exists (should be in the inline content)
        const { inlines } = extractContentTypesFromPost(editingPost);
        if (inlines.length > 0) {
          const captionText = typeof inlines[0] === 'string' ? inlines[0] : '';
          setCaption(captionText);

          // Store caption in draft
          if (captionText) {
            const jsonContent = {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: captionText }],
                },
              ],
            };
            storeDraft(jsonContent, 'caption');
          }
        }

        // Set up image for editing by creating a mock attachment from the existing image
        if ('image' in blocks[0]) {
          const imageBlock = blocks[0].image;
          // Create a mock attachment for the image
          const mockAttachment = {
            type: 'image' as const,
            file: {
              uri: imageBlock.src,
              width: imageBlock.width,
              height: imageBlock.height,
            } as ImagePickerAsset,
            uploadState: {
              status: 'complete' as const,
              remoteUri: imageBlock.src,
            },
          };

          // Set the attachment for editing
          attachAssets([mockAttachment.file]);
          setRoute('image');
          setCanPost(true);
        }

        if ('link' in blocks[0]) {
          const linkBlock = blocks[0].link as { url: string };
          console.log('linkBlock', linkBlock);
          const mockAttachment: domain.LinkAttachment = {
            type: 'link' as const,
            url: linkBlock.url,
          };
          addAttachment(mockAttachment);
          setRoute('link');
          setCanPost(true);
        }
      } else {
        // If not an image post, use the BigInput for editing text gallery posts
        setRoute('text');
      }
    } catch (error) {
      console.error('Error determining gallery post type:', error);
      // Default to BigInput if we can't determine the type
      setRoute('link');
    }
  }, [editingPost, storeDraft, attachAssets, addAttachment]);

  // Reset all gallery-related state
  const resetGalleryState = useCallback(() => {
    setCanPost(false);
    setCaption('');
    clearDraft('caption');
    resetAttachments([]);
    setRoute('gallery');
    // Don't call setEditingPost here, as it's now handled in handlePost
    // This prevents the blank BigInput from showing after saving
  }, [clearDraft, resetAttachments]);

  // Handle image selection
  const handleGalleryImageSet = useCallback(
    (assets?: ImagePickerAsset[] | null) => {
      const hasAssets = !!assets;
      setRoute(hasAssets ? 'image' : 'gallery');
      setCanPost(hasAssets);
    },
    []
  );

  // Load caption from draft when image is being uploaded
  useEffect(() => {
    if (!(route === 'image' && !editingPost)) return;

    getDraft('caption').then((draft) => {
      if (!draft || typeof draft !== 'object' || !('content' in draft)) return;

      const text = draft.content?.[0]?.content?.[0]?.text || '';
      setCaption(text);
    });
  }, [route, editingPost, getDraft]);

  // Store caption in draft when it changes
  useEffect(() => {
    if (!(route === 'image' && !editingPost) || !caption) return;

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
  }, [caption, route, editingPost, storeDraft]);

  // Notify host when changing presentation mode
  useEffect(() => {
    const isFullscreen =
      route === 'text' || route === 'image' || route === 'link';
    onPresentationModeChange?.(isFullscreen ? 'fullscreen' : 'inline');
  }, [route, onPresentationModeChange]);

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
          attachment.uploadState.status === 'success' &&
          'remoteUri' in attachment.uploadState &&
          attachment.uploadState.remoteUri
      );

      if (imageAttachments.length === 0) {
        console.error('No image attachments found for gallery post');
        setIsPosting(false);
        return;
      }

      // Create a story with the caption and image blocks
      // Only include caption if it exists (avoid empty strings)
      const story = caption ? constructStory([caption]) : constructStory([]);

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

      // If editing, use the editPost function from the context
      if (isEditingPost && editPost && editingPost) {
        await editPost(editingPost, story);

        // IMPORTANT: The order of these operations is critical to prevent unwanted UI transitions
        // First reset all gallery-related state to clean up the editing environment
        resetGalleryState();

        // Then clear the editing state to prevent BigInput from showing
        // This must happen after resetGalleryState to avoid triggering the BigInput display
        if (setEditingPost) {
          setEditingPost(undefined);
        }

        // Force inline presentation mode to return to the gallery view
        // This ensures we exit the fullscreen editing mode completely
        onPresentationModeChange?.('inline');
      } else {
        // Otherwise send as a new post
        await sendPost(story, channel.id, metadata);
        resetGalleryState();
      }

      // Reset posting state after a short delay
      setTimeout(() => setIsPosting(false), 500);
    } catch (error) {
      console.error('Error posting gallery image:', error);
      setIsPosting(false);
    }
  }, [
    caption,
    isPosting,
    sendPost,
    channel.id,
    waitForAttachmentUploads,
    resetGalleryState,
    isEditingPost,
    editPost,
    editingPost,
    setEditingPost,
    onPresentationModeChange,
  ]);

  const handleAdd = useCallback(() => {
    setRoute('add-post');

    if (logic.isPersonalCollectionChannel(channel.id)) {
      db.wayfindingProgress.setValue((prev) => ({
        ...prev,
        tappedAddCollection: true,
      }));
    }
  }, [channel.id]);

  const handleLinkPost = useCallback(
    async ({ content, meta }: LinkInputSaveParams) => {
      if (isPosting) return;

      try {
        setIsPosting(true);

        const story = constructStory([content]);
        // If editing, use the editPost function from the context
        if (isEditingPost && editPost && editingPost) {
          await editPost(editingPost, story, undefined, meta);

          // IMPORTANT: The order of these operations is critical to prevent unwanted UI transitions
          // First reset all gallery-related state to clean up the editing environment
          resetGalleryState();

          // Then clear the editing state to prevent BigInput from showing
          // This must happen after resetGalleryState to avoid triggering the BigInput display
          if (setEditingPost) {
            setEditingPost(undefined);
          }

          // Force inline presentation mode to return to the gallery view
          // This ensures we exit the fullscreen editing mode completely
          onPresentationModeChange?.('inline');
        } else {
          // Otherwise send as a new post
          await sendPost(story, channel.id, meta);
          resetGalleryState();
        }

        // Reset posting state after a short delay
        setTimeout(() => setIsPosting(false), 500);
      } catch (error) {
        console.error('Error posting link:', error);
        setIsPosting(false);
      }
    },
    [
      isPosting,
      isEditingPost,
      editPost,
      editingPost,
      resetGalleryState,
      setEditingPost,
      onPresentationModeChange,
      sendPost,
      channel.id,
    ]
  );

  // Register the "Add" button in the header
  useRegisterChannelHeaderItem(
    useMemo(
      () =>
        route !== 'gallery' && route !== 'add-post' ? null : (
          <>
            <ScreenHeader.IconButton
              key="gallery"
              type="Add"
              onPress={handleAdd}
              testID="AddGalleryPost"
            />
            <Notices.CollectionInputTooltip channelId={channel.id} />
          </>
        ),
      [route, handleAdd, channel.id]
    )
  );

  // Register the "Post" button in the header when showing image preview or editing image gallery post
  useRegisterChannelHeaderItem(
    useMemo(
      () =>
        route === 'image' ? (
          <ScreenHeader.TextButton
            key="gallery-preview-post"
            onPress={handlePost}
            disabled={!canPost || isPosting}
            testID="GalleryPostButton"
          >
            {isPosting ? 'Posting...' : isEditingPost ? 'Save' : 'Post'}
          </ScreenHeader.TextButton>
        ) : null,
      [handlePost, canPost, isPosting, isEditingPost, route]
    )
  );

  // Expose methods to parent component through the ref
  // useImperativeHandle allows the parent component to call these methods via the draftInputRef
  // This creates a controlled interface for the parent to manage this component's state
  useImperativeHandle(
    draftInputRef,
    () => ({
      // exitFullscreen: Called by parent when user presses back or after saving a post
      // Handles proper cleanup and state reset to ensure smooth UI transitions
      exitFullscreen: () => {
        if (route === 'image') {
          // First reset gallery state
          resetGalleryState();

          // Then clear editing state to prevent BigInput from showing
          if (isEditingPost && setEditingPost) {
            setEditingPost(undefined);
          }

          // Force inline presentation mode
          onPresentationModeChange?.('inline');
        } else {
          setRoute('gallery');
        }
      },
      // startDraft: Called by parent when user wants to create a new gallery post
      startDraft: () => setRoute('add-post'),
    }),
    [
      resetGalleryState,
      isEditingPost,
      route,
      setEditingPost,
      onPresentationModeChange,
    ]
  );

  const setShowBigInput = useCallback((open: boolean) => {
    setRoute(open ? 'text' : 'gallery');
  }, []);

  return (
    <>
      {/* Big input for editing text gallery posts */}
      {route === 'text' && (
        <DraftInputConnectedBigInput
          draftInputContext={{
            ...draftInputContext,
            editingPost,
          }}
          setShowBigInput={setShowBigInput}
          overrideChannelType="gallery"
        />
      )}

      {/* Image preview and caption input - shown for both new image posts and editing image gallery posts */}
      {/* This is the UI for creating/editing image gallery posts */}
      {route === 'image' && (
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
                    color: theme.primaryText.val,
                  }}
                />
              </View>
            </View>
          </ParentAgnosticKeyboardAvoidingView>
        </YStack>
      )}

      {/* Link input - shown when creating/editing rich link posts that contain metadata */}
      {route === 'link' && (
        <LinkInput
          isPosting={isPosting}
          editingPost={editingPost}
          onSave={handleLinkPost}
        />
      )}

      {/* Add gallery post sheet */}
      <AddGalleryPost
        route={route}
        setRoute={setRoute}
        onSetImage={handleGalleryImageSet}
      />
    </>
  );
}
