import { JSONContent } from '@tloncorp/api/urbit';
import {
  PLACEHOLDER_ASSET_URI,
  extractContentTypesFromPost,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import {
  ForwardingProps,
  ParentAgnosticKeyboardAvoidingView,
} from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack, useTheme } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import AddGalleryPost from '../AddGalleryPost';
import AttachmentPreview from '../Channel/AttachmentPreview';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { ScreenHeader } from '../ScreenHeader';
import Notices from '../Wayfinding/Notices';
import { DraftInputConnectedBigInput } from './DraftInputConnectedBigInput';
import { LinkInput, LinkInputSaveParams } from './LinkInput';
import { DraftInputContext, GalleryRoute } from './shared';

const isPlaceholderImageAttachment = (attachment: domain.Attachment) =>
  attachment.type === 'image' && attachment.file.uri === PLACEHOLDER_ASSET_URI;

const getDraftText = (draft: JSONContent | null): string =>
  draft?.content?.[0]?.content?.[0]?.text || '';

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
    sendPostFromDraft,
    storeDraft,
    setEditingPost,
  } = draftInputContext;

  const safeAreaInsets = useSafeAreaInsets();
  const { attachments, resetAttachments, addAttachment, attachAssets } =
    useAttachmentContext();
  // Attachment review is postable whenever there is a real attachment, but we
  // still ignore the placeholder image we attach during media selection.
  const hasRealAttachments = useMemo(
    () => attachments.some((attachment) => !isPlaceholderImageAttachment(attachment)),
    [attachments]
  );

  const [route, setRoute] = useState<GalleryRoute>('gallery');
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const isEditingPost = editingPost != null;

  // Set up the editing UI based on the post type (image, link, or text)
  useEffect(() => {
    if (!editingPost) return;

    try {
      const { blocks } = extractContentTypesFromPost(editingPost);

      // Check if the first block is an image or link - if so, handle it specially
      if (blocks.length > 0 && 'image' in blocks[0]) {
        // This is an image gallery post
        setRoute('review-attachment');

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
        const imageBlock = blocks[0].image;
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

        attachAssets([
          domain.Attachment.UploadIntent.fromImagePickerAsset(
            mockAttachment.file
          ),
        ]);
      } else if (blocks.length > 0 && 'link' in blocks[0]) {
        // This is a link gallery post
        const linkBlock = blocks[0].link as { url: string };
        const mockAttachment: domain.LinkAttachment = {
          type: 'link' as const,
          url: linkBlock.url,
        };
        addAttachment(mockAttachment);
        setRoute('link');
      } else {
        // This is a text gallery post (blocks with paragraphs, bullet points, etc.)
        // Use the BigInput for editing text gallery posts
        setRoute('text');
      }
    } catch (error) {
      console.error('Error determining gallery post type:', error);
      // Default to text input if we can't determine the type
      setRoute('text');
    }
  }, [editingPost, storeDraft, attachAssets, addAttachment]);

  // Reset all gallery-related state
  const resetGalleryState = useCallback(() => {
    setCaption('');
    setLinkUrl('');
    clearDraft('caption');
    clearDraft('link');
    resetAttachments([]);
    setRoute('gallery');
    // Don't call setEditingPost here, as it's now handled in handlePost
    // This prevents the blank BigInput from showing after saving
  }, [clearDraft, resetAttachments]);

  // Handle image selection
  const handleGalleryImageSet = useCallback(
    (assets?: domain.Attachment.UploadIntent[] | null) => {
      const hasAssets = assets != null && assets.length > 0;
      setRoute(hasAssets ? 'review-attachment' : 'gallery');
    },
    []
  );

  // For image/video picks we often attach a placeholder immediately and then
  // normalize metadata (e.g. poster generation) asynchronously. Move to review
  // as soon as any attachment exists so UI does not wait on normalization.
  useEffect(() => {
    if (editingPost) {
      return;
    }

    const hasAttachments = attachments.length > 0;

    if (
      hasAttachments &&
      (route === 'gallery' ||
        route === 'add-post' ||
        route === 'add-attachment')
    ) {
      setRoute('review-attachment');
      return;
    }

    if (!hasAttachments && route === 'review-attachment') {
      setRoute('gallery');
    }
  }, [attachments.length, editingPost, route]);

  // Load caption from draft when image is being uploaded
  useEffect(() => {
    if (!(route === 'review-attachment' && !editingPost)) return;

    getDraft('caption').then((draft) => {
      setCaption(getDraftText(draft));
    });
  }, [route, editingPost, getDraft]);

  useEffect(() => {
    if (route === 'link' && !editingPost) {
      getDraft('link').then((draft) => {
        setLinkUrl(getDraftText(draft));
      });
    }
  }, [route, editingPost, getDraft]);

  // Store caption in draft when it changes
  useEffect(() => {
    if (!(route === 'review-attachment' && !editingPost) || !caption) return;

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
      route === 'text' || route === 'review-attachment' || route === 'link';
    onPresentationModeChange?.(isFullscreen ? 'fullscreen' : 'inline');
  }, [route, onPresentationModeChange]);

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

        const draft: domain.PostDataDraft = {
          channelId: channel.id,
          content: [content],
          attachments: [],
          channelType: channel.type,
          replyToPostId: null,
          title: meta?.title,
          image: meta?.image,
          ...(isEditingPost && editingPost != null
            ? { isEdit: true, editTargetPostId: editingPost.id }
            : { isEdit: false }),
        };

        await sendPostFromDraft(draft);

        // IMPORTANT: The order of these operations is critical to prevent unwanted UI transitions
        // First reset all gallery-related state to clean up the editing environment
        resetGalleryState();

        // If editing, force inline presentation mode
        if (isEditingPost) {
          if (setEditingPost) {
            setEditingPost(undefined);
          }
          onPresentationModeChange?.('inline');
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
      editingPost,
      resetGalleryState,
      setEditingPost,
      onPresentationModeChange,
      sendPostFromDraft,
      channel.id,
      channel.type,
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

  // Expose methods to parent component through the ref
  // useImperativeHandle allows the parent component to call these methods via the draftInputRef
  // This creates a controlled interface for the parent to manage this component's state
  useImperativeHandle(
    draftInputRef,
    () => ({
      // exitFullscreen: Called by parent when user presses back or after saving a post
      // Handles proper cleanup and state reset to ensure smooth UI transitions
      exitFullscreen: () => {
        if (route === 'review-attachment') {
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
      startDraft: (mode) => {
        if (mode === 'text' || mode === 'link') {
          setRoute(mode);
          return;
        }

        setRoute('add-post');
      },
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

  const onAttachmentPostSent = useCallback(() => {
    // IMPORTANT: The order of these operations is critical to prevent unwanted UI transitions
    // First reset all gallery-related state to clean up the editing environment
    resetGalleryState();
    setEditingPost?.(undefined);
    onPresentationModeChange?.('inline');

    // TODO: I don't think this is necessary
    // // If editing, force inline presentation mode to return to the gallery view
    // if (isEditingPost) {
    //   if (setEditingPost) {
    //     setEditingPost(undefined);
    //   }
    //   onPresentationModeChange?.('inline');
    // }
    // // Reset posting state after a short delay
    // setTimeout(() => setIsPosting(false), 500);
  }, [resetGalleryState, setEditingPost, onPresentationModeChange]);

  return (
    <>
      {/* Big input for editing text gallery posts */}
      {route === 'text' && (
        <DraftInputConnectedBigInput
          draftInputContext={{
            ...draftInputContext,
            editingPost,
          }}
          draftType="text"
          setShowBigInput={setShowBigInput}
          overrideChannelType="gallery"
        />
      )}

      {/* Image preview and caption input - shown for both new image posts and editing image gallery posts */}
      {/* This is the UI for creating/editing image gallery posts */}
      {route === 'review-attachment' && (
        <ReviewAttachment
          draftInputContext={draftInputContext}
          caption={caption}
          setCaption={setCaption}
          onPostSent={onAttachmentPostSent}
          canPost={hasRealAttachments}
          flex={1}
          width={'100%'}
          bottom={safeAreaInsets.bottom}
        />
      )}

      {/* Link input - shown when creating/editing rich link posts that contain metadata */}
      {route === 'link' && (
        <LinkInput
          initialUrl={linkUrl}
          isPosting={isPosting}
          editingPost={editingPost}
          onSave={handleLinkPost}
        />
      )}

      {/* Add gallery post sheet */}
      <AddGalleryPost
        route={route}
        setRoute={setRoute}
        onSetMedia={handleGalleryImageSet}
      />
    </>
  );
}

function ReviewAttachment({
  caption,
  setCaption,
  draftInputContext,
  onPostSent,
  canPost,
  ...forwardedProps
}: ForwardingProps<
  typeof YStack,
  {
    caption: string;
    setCaption: (caption: string) => void;
    draftInputContext: DraftInputContext;
    onPostSent?: () => void;
    canPost: boolean;
  }
>) {
  const {
    channel,
    editingPost,
    onPresentationModeChange,
    sendPostFromDraft,
    setEditingPost,
  } = draftInputContext;
  const isEditingPost = editingPost != null;

  const theme = useTheme();
  const [isPosting, setIsPosting] = useState(false);
  const { attachments } = useAttachmentContext();

  // Handle posting the gallery image
  const handlePost = useCallback(async () => {
    if (isPosting) return;

    try {
      setIsPosting(true);

      // Build the draft with caption content and image attachments
      // Caption goes in content, images go in attachments
      const captionContent = caption ? [caption] : [];

      // Extract image URI from the first image attachment for the draft's image field
      const imageAttachment = attachments.find(
        (att) => att.type === 'image' && 'file' in att
      );
      const imageUri =
        imageAttachment?.type === 'image' && 'file' in imageAttachment
          ? imageAttachment.file.uri
          : undefined;

      const draft: domain.PostDataDraft = {
        channelId: channel.id,
        content: captionContent,
        attachments,
        channelType: channel.type,
        replyToPostId: null,
        image: imageUri,
        ...(isEditingPost && editingPost != null
          ? { isEdit: true, editTargetPostId: editingPost.id }
          : { isEdit: false }),
      };

      await sendPostFromDraft(draft);

      // IMPORTANT: The order of these operations is critical to prevent unwanted UI transitions
      // First reset all gallery-related state to clean up the editing
      // environment via `onPostSent`, which should call resetGalleryState :|
      onPostSent?.();

      // If editing, force inline presentation mode to return to the gallery view
      if (isEditingPost) {
        if (setEditingPost) {
          setEditingPost(undefined);
        }
        onPresentationModeChange?.('inline');
      }
      // Reset posting state after a short delay
      const timeoutHandle = setTimeout(() => setIsPosting(false), 500);
      return () => clearTimeout(timeoutHandle);
    } catch (error) {
      console.error('Error posting gallery image:', error);
      setIsPosting(false);
    }
  }, [
    attachments,
    caption,
    isPosting,
    sendPostFromDraft,
    channel.id,
    channel.type,
    onPostSent,
    isEditingPost,
    editingPost,
    setEditingPost,
    onPresentationModeChange,
  ]);

  // Register the "Post" button in the header when showing image preview or editing image gallery post
  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="gallery-preview-post"
          onPress={handlePost}
          disabled={!canPost || isPosting}
          testID="GalleryPostButton"
        >
          {isPosting ? 'Posting...' : isEditingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [handlePost, canPost, isPosting, isEditingPost]
    )
  );

  return (
    <YStack alignItems="stretch" {...forwardedProps}>
      <ParentAgnosticKeyboardAvoidingView
        contentContainerStyle={{ flex: 1, paddingTop: 32 }}
      >
        <XStack backgroundColor="$background" flex={1}>
          <View flex={1} position="relative">
            <AttachmentPreview />
          </View>
        </XStack>
        <View padding="$l">
          <View
            backgroundColor="$background"
            padding="$m"
            borderWidth={1}
            borderRadius="$xl"
            borderColor="$border"
          >
            <TextInput
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
  );
}
