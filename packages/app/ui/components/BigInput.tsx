import {
  Attachment,
  createDevLogger,
  extractContentTypesFromPost,
  htmlToStory,
  markdownToStory,
  postContentToHtml,
  storyToContent,
  storyToHtml,
  storyToMarkdown,
  tiptap,
  uploadAsset as uploadAssetToStorage,
  waitForUploads,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { Block, Inline, constructStory } from '@tloncorp/api/urbit';
import {
  Button,
  Icon,
  Image,
  Text,
  View,
  useIsWindowNarrow,
  useToast,
} from '@tloncorp/ui';
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, XStack, getTokenValue, useTheme } from 'tamagui';

import { useQuery } from '@tanstack/react-query';
import { useFeatureFlag } from '../../lib/featureFlags';
import { useAttachmentContext } from '../contexts';
import AttachmentSheet from './AttachmentSheet';
import { createMentionRoleOptions, MentionOption } from './BareChatInput/useMentions';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { MarkdownEditor } from './MarkdownEditor';
import MentionPopup from './MentionPopup';
import { EnrichedNoteInput, EnrichedNoteInputRef, PastedImage } from './MessageInput/EnrichedNoteInput';
import { FormattingToolbar } from './MessageInput/FormattingToolbar';
import { MessageInput } from './MessageInput';
import { InputToolbar } from './MessageInput/InputToolbar';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import {
  DEFAULT_TOOLBAR_ITEMS,
  TlonBridgeState,
  TlonEditorBridge,
  ToolbarItem,
} from './MessageInput/toolbarActions';
import { ScreenHeader } from './ScreenHeader';

const logger = createDevLogger('BigInput', true);

/**
 * Manages markdown-mode state and the conversions between markdown text and
 * the rich-text (TipTap) editor.  Extracted so BigInput can stay focused on
 * layout / send / attachment concerns.
 */
function useMarkdownMode({
  editingPost,
  markdownNotebooksEnabled,
  editorRef,
  showToast,
}: {
  editingPost?: db.Post;
  markdownNotebooksEnabled: boolean;
  editorRef: RefObject<{ editor: TlonEditorBridge | null } | null>;
  showToast: (opts: { message: string; duration: number }) => void;
}) {
  // Default to markdown mode if feature flag is enabled and this is a new post
  const [isMarkdownMode, setIsMarkdownMode] = useState(
    markdownNotebooksEnabled && !editingPost
  );
  const [markdownContent, setMarkdownContent] = useState('');
  // When switching back from Markdown mode the TipTap editor may not be
  // mounted yet.  We park the converted content here and apply it as soon as
  // the editor reports ready via handleEditorStateChange.
  const [pendingEditorContent, setPendingEditorContent] = useState<
    object | null
  >(null);

  const handleEditorStateChange = useCallback(
    (state: { isReady: boolean }) => {
      if (state.isReady && pendingEditorContent && editorRef.current?.editor) {
        logger.log(
          'Editor ready, setting pending content from Markdown conversion'
        );
        // @ts-expect-error setContent does accept JSONContent
        editorRef.current.editor.setContent(pendingEditorContent);
        setPendingEditorContent(null);
      }
    },
    [pendingEditorContent, editorRef]
  );

  const handleMarkdownToggle = useCallback(async () => {
    if (!isMarkdownMode) {
      // Switching TO Markdown mode: convert rich text to Markdown
      try {
        let story = null;

        // First, try to get content from the Tiptap editor
        if (editorRef.current?.editor) {
          const json = await editorRef.current.editor.getJSON();
          if (!contentIsEmpty(json)) {
            // Use codeWithLang=true to properly handle code blocks as Block types
            // and limitNewlines=false to preserve paragraph structure
            const inlines = tiptap.JSONToInlines(json, false, true);
            story = constructStory(inlines);
          }
        }

        // If editor is empty and we're editing an existing post, use the post's content
        if (!story && editingPost?.content) {
          const postContent = editingPost.content as { story?: any };
          if (postContent.story && Array.isArray(postContent.story)) {
            story = postContent.story;
          }
        }

        // Convert story to markdown if we have content
        const markdown = story ? storyToMarkdown(story) : '';
        setMarkdownContent(markdown);
        setIsMarkdownMode(true);
      } catch (error) {
        logger.error('Failed to convert to Markdown:', error);
        showToast({
          message: 'Failed to convert content to Markdown',
          duration: 2000,
        });
      }
    } else {
      // Switching FROM Markdown mode: convert Markdown to rich text
      try {
        if (markdownContent) {
          const story = markdownToStory(markdownContent);
          const tiptapContent = tiptap.diaryMixedToJSON(story);
          // Store the content to be set when editor becomes ready
          setPendingEditorContent(tiptapContent);
        }
        setIsMarkdownMode(false);
      } catch (error) {
        logger.error('Failed to convert from Markdown:', error);
        showToast({
          message: 'Failed to convert Markdown to rich text',
          duration: 2000,
        });
      }
    }
  }, [isMarkdownMode, markdownContent, showToast, editingPost, editorRef]);

  const reset = useCallback(() => {
    setMarkdownContent('');
    setIsMarkdownMode(false);
  }, []);

  return {
    isMarkdownMode,
    markdownContent,
    setMarkdownContent,
    handleMarkdownToggle,
    handleEditorStateChange,
    reset,
  };
}

export function BigInput({
  sendPostFromDraft,
  channelId,
  channelType,
  editingPost,
  setShowBigInput,
  clearDraft,
  storeDraft,
  getDraft,
  draftType,
  setShouldBlur,
  groupMembers,
  groupRoles,
  ...props
}: MessageInputProps & {
  channelId: string;
  channelType: string;
  editingPost?: db.Post;
  setShowBigInput?: (show: boolean) => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const [title, setTitle] = useState(editingPost?.title || '');
  const [imageUri, setImageUri] = useState<string | null>(
    editingPost?.image || null
  );
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showInlineImageSheet, setShowInlineImageSheet] = useState(false);
  const [hasContentChanges, setHasContentChanges] = useState(false);
  const [hasTitleChanges, setHasTitleChanges] = useState(false);
  const [hasImageChanges, setHasImageChanges] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(!isWindowNarrow);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const editorRef = useRef<{ editor: TlonEditorBridge | null }>(null);
  const enrichedEditorRef = useRef<EnrichedNoteInputRef>(null);
  const [enrichedEditorState, setEnrichedEditorState] =
    useState<TlonBridgeState | null>(null);
  const [enrichedHtml, setEnrichedHtml] = useState('');
  const [enrichedInitialHtml, setEnrichedInitialHtml] = useState<string | undefined>(undefined);
  // Mention state for enriched editor (native mention detection)
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionSearchText, setMentionSearchText] = useState('');
  const [mentionIndicator, setMentionIndicator] = useState('');
  const inlineImageSelectionRef = useRef<{ from: number; to: number } | null>(
    null
  );
  const isMountedRef = useRef(true);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const showToast = useToast();
  const [isEmpty, setIsEmpty] = useState(true);
  const [markdownNotebooksEnabled] = useFeatureFlag('markdownNotebooks');
  const [enrichedInputFlag] = useFeatureFlag('enrichedInput');
  const enrichedInputEnabled = enrichedInputFlag && Platform.OS !== 'web';
  const {
    isMarkdownMode,
    markdownContent,
    setMarkdownContent,
    handleMarkdownToggle,
    handleEditorStateChange,
    reset: resetMarkdownMode,
  } = useMarkdownMode({
    editingPost,
    markdownNotebooksEnabled,
    editorRef,
    showToast,
  });
  const { attachments, clearAttachments } = useAttachmentContext();

  // Mention support for enriched editor
  const roleOptions = useMemo(
    () => createMentionRoleOptions(groupRoles),
    [groupRoles]
  );

  const { data: mentionCandidates = [] } = useQuery({
    queryKey: ['mentionCandidates', channelId, mentionSearchText],
    queryFn: () =>
      db.getMentionCandidates({ chatId: channelId, query: mentionSearchText }),
    placeholderData: (prev) => prev || [],
    enabled: enrichedInputEnabled && mentionActive && mentionSearchText.trim().length > 0,
    select: (data) =>
      data.map((c) => ({
        id: c.id,
        title: c.nickname || c.id,
        subtitle: c.id,
        type: 'contact' as const,
        priority: c.priority,
        contact: { id: c.id, nickname: c.nickname, avatarImage: c.avatarImage } as db.Contact,
      })),
  });

  const mentionOptions = useMemo(() => {
    const filteredRoles = roleOptions.filter(
      (o) =>
        mentionSearchText.trim().length > 0 &&
        o.title?.toLowerCase().startsWith(mentionSearchText.toLowerCase())
    );
    return [...filteredRoles, ...mentionCandidates].sort(
      (a, b) => a.priority - b.priority
    );
  }, [roleOptions, mentionCandidates, mentionSearchText]);

  const handleStartMention = useCallback((indicator: string) => {
    setMentionActive(true);
    setMentionIndicator(indicator);
    setMentionSearchText('');
  }, []);

  const handleChangeMention = useCallback((_indicator: string, text: string) => {
    setMentionSearchText(text);
  }, []);

  const handleEndMention = useCallback(() => {
    setMentionActive(false);
    setMentionSearchText('');
  }, []);

  const handleSelectMention = useCallback(
    (option: MentionOption) => {
      const editor = enrichedEditorRef.current?.editor;
      if (!editor) return;
      const displayText = option.title || option.id;
      (editor as any).setMention(mentionIndicator, displayText, option.id);
      setMentionActive(false);
      setMentionSearchText('');
    },
    [mentionIndicator]
  );

  const handleEditorContentChanged = useCallback(
    (content?: object) => {
      const hasAttachmentsAndIsGallery =
        attachments.length > 0 && channelType === 'gallery';
      const nextIsEmpty =
        contentIsEmpty(content) && !hasAttachmentsAndIsGallery;
      logger.log('Content empty check:', nextIsEmpty);
      if (content && editingPost?.content) {
        const originalContent = editingPost.content as { story: any };
        const inlines = tiptap.JSONToInlines(content);
        const story = constructStory(inlines);
        const hasChanges =
          JSON.stringify(story) !== JSON.stringify(originalContent.story);
        logger.log('Content changes:', hasChanges);
        setHasContentChanges(hasChanges);
      } else {
        logger.log('New content, not empty:', !nextIsEmpty);
        setHasContentChanges(!nextIsEmpty);
      }
      setIsEmpty(nextIsEmpty);
    },
    [editingPost?.content, attachments, channelType]
  );

  useEffect(() => {
    setHasTitleChanges(title !== editingPost?.title);
    setHasImageChanges(imageUri !== editingPost?.image);
  }, [title, imageUri, editingPost]);

  // Update isEmpty state when in Markdown mode
  useEffect(() => {
    if (isMarkdownMode) {
      const markdownIsEmpty = !markdownContent || markdownContent.trim() === '';
      setIsEmpty(markdownIsEmpty);
      if (editingPost?.content) {
        const originalContent = editingPost.content as { story?: any };
        const hasOriginalContent =
          originalContent.story && Array.isArray(originalContent.story);
        setHasContentChanges(hasOriginalContent ? !markdownIsEmpty : false);
      } else {
        setHasContentChanges(!markdownIsEmpty);
      }
    }
  }, [isMarkdownMode, markdownContent, editingPost?.content]);

  // Update isEmpty state when using enriched editor
  useEffect(() => {
    if (enrichedInputEnabled) {
      // Strip tags for a rough empty check
      const textOnly = enrichedHtml.replace(/<[^>]*>/g, '').trim();
      const htmlIsEmpty = !textOnly;
      setIsEmpty(htmlIsEmpty);
      if (editingPost?.content) {
        const originalContent = editingPost.content as { story?: any };
        const hasOriginalContent =
          originalContent.story && Array.isArray(originalContent.story);
        setHasContentChanges(hasOriginalContent ? !htmlIsEmpty : false);
      } else {
        setHasContentChanges(!htmlIsEmpty);
      }
    }
  }, [enrichedInputEnabled, enrichedHtml, editingPost?.content]);

  // Load initial HTML content when editing an existing post with enriched editor
  useEffect(() => {
    if (enrichedInputEnabled && editingPost?.content) {
      try {
        const { story } = extractContentTypesFromPost(editingPost);
        logger.log('editingPost postContent:', JSON.stringify(story));
        if (!story) return;
        // Content can be either PostContent (BlockData[]) or Story (Verse[]).
        // Detect by checking if items have 'type' field (PostContent) or
        // 'inline'/'block' fields (Story).
        const firstItem = story[0] as any;
        let html: string;
        if (firstItem && ('inline' in firstItem || 'block' in firstItem)) {
          // Story (Verse[]) format
          const innerHtml = storyToHtml(story as any);
          html = innerHtml ? `<html>${innerHtml}</html>` : '';
        } else {
          // PostContent (BlockData[]) format
          html = postContentToHtml(story as any);
        }
        logger.log('initialHtml:', html);
        setEnrichedInitialHtml(html);
        setEnrichedHtml(html);
      } catch (e) {
        logger.error('Failed to load post content into enriched editor', e);
      }
    }
  }, [enrichedInputEnabled, editingPost?.id]);

  // Load draft on mount for enriched editor (when not editing an existing post)
  useEffect(() => {
    if (!enrichedInputEnabled || editingPost) return;
    (async () => {
      const draft = await getDraft(draftType);
      if (draft && (draft as any).type === 'enrichedHtml') {
        const html = (draft as any).html as string;
        if (html) {
          setEnrichedInitialHtml(html);
          setEnrichedHtml(html);
        }
      }
    })().catch((e) => logger.error('Failed to load enriched draft', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedInputEnabled]);

  // Save draft on enriched HTML changes
  useEffect(() => {
    if (!enrichedInputEnabled || editingPost) return;
    const textOnly = enrichedHtml.replace(/<[^>]*>/g, '').trim();
    if (!textOnly) {
      clearDraft(draftType);
      return;
    }
    // Store as a custom JSON shape so we can distinguish from TipTap drafts
    storeDraft({ type: 'enrichedHtml', html: enrichedHtml } as any, draftType).catch(
      (e) => logger.error('Failed to store enriched draft', e)
    );
  }, [enrichedInputEnabled, enrichedHtml, editingPost, storeDraft, clearDraft, draftType]);

  // Determine if the post/save button should be enabled - with direct content check
  useEffect(() => {
    let enabled = false;
    if (editingPost) {
      enabled = hasContentChanges || hasTitleChanges || hasImageChanges;
    } else {
      if (channelType === 'notebook') {
        enabled = !isEmpty && !!title;
      } else {
        enabled = !isEmpty;
      }
    }
    setIsButtonEnabled(enabled);
  }, [
    editingPost,
    hasContentChanges,
    hasTitleChanges,
    hasImageChanges,
    title,
    channelType,
    isEmpty,
  ]);

  // Handle sending/editing the post
  const handleSend = useCallback(async () => {
    setIsSending(true);

    let content: (Inline | Block)[];

    if (enrichedInputEnabled) {
      // Enriched editor: convert HTML to Story
      try {
        logger.log('enrichedHtml:', enrichedHtml);
        // Strip <html> wrapper that the enriched editor adds
        const innerHtml = enrichedHtml
          .replace(/^<html>\n?/, '')
          .replace(/\n?<\/html>$/, '');
        const story = htmlToStory(innerHtml);
        logger.log('story:', JSON.stringify(story));
        content = storyToContent(story);
        logger.log('content:', JSON.stringify(content));
      } catch (error) {
        logger.error('Failed to convert HTML for send:', error);
        showToast({
          message: 'Failed to process content',
          duration: 2000,
        });
        setIsSending(false);
        return;
      }
    } else if (isMarkdownMode) {
      // Convert Markdown content to Story, then extract inlines and blocks
      try {
        const story = markdownToStory(markdownContent);
        content = storyToContent(story);
      } catch (error) {
        logger.error('Failed to convert Markdown for send:', error);
        showToast({
          message: 'Failed to process content',
          duration: 2000,
        });
        setIsSending(false);
        return;
      }
    } else {
      // Rich text mode: get content from Tiptap editor
      if (!editorRef.current?.editor) {
        setIsSending(false);
        return;
      }
      const json = await editorRef.current.editor.getJSON();
      content = tiptap.JSONToInlines(json);
    }

    const draft: domain.PostDataDraft = {
      channelId,
      content,
      attachments,
      title,
      image: imageUri ?? undefined,
      channelType,
      replyToPostId: null,
      ...(editingPost == null
        ? { isEdit: false }
        : {
            isEdit: true,
            editTargetPostId: editingPost.id,
          }),
    };

    try {
      // Store the channel type for later use after async operations
      const currentChannelType = channelType;
      const isGalleryText = currentChannelType === 'gallery';

      const sendOperation = sendPostFromDraft(draft);

      // Clear the draft immediately so it doesn't persist if the user
      // navigates away while the send is in flight
      if (!editingPost && clearDraft) {
        try {
          logger.log(
            `Clearing draft for ${isGalleryText ? 'gallery text' : currentChannelType}`
          );

          if (isGalleryText) {
            await clearDraft('text');
            await clearDraft(undefined);
          } else {
            await clearDraft(undefined);
          }
          logger.log('Draft cleared successfully');
        } catch (e) {
          logger.error('Error clearing draft:', e);
        }
      }

      await sendOperation;

      logger.log(
        `Post/save successful for channel type: ${currentChannelType}`
      );

      // Clear all state first
      setTitle('');
      setImageUri(null);
      setHasContentChanges(false);
      setHasTitleChanges(false);
      setHasImageChanges(false);
      setShowFormatMenu(false);
      setShowBigInput?.(false);
      clearAttachments();
      resetMarkdownMode();

      // For notebook posts, don't clear editor content since the component unmounts anyway
      // This prevents triggering _onContentUpdate which could save a draft after publish
      if (currentChannelType !== 'notebook' && editorRef.current?.editor) {
        logger.log('Clearing editor content after save');
        editorRef.current.editor.setContent('');
      }
    } catch (error) {
      logger.error('Failed to save post:', error);
    } finally {
      setIsSending(false);
    }
  }, [
    sendPostFromDraft,
    channelId,
    title,
    imageUri,
    channelType,
    setShowBigInput,
    editingPost,
    clearDraft,
    setShowFormatMenu,
    clearAttachments,
    attachments,
    enrichedInputEnabled,
    enrichedHtml,
    isMarkdownMode,
    markdownContent,
    showToast,
  ]);

  // Register the "Post" button in the header
  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="big-input-post"
          onPress={handleSend}
          testID="BigInputPostButton"
          disabled={!isButtonEnabled || isSending}
        >
          {editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [handleSend, editingPost, isButtonEnabled, isSending]
    )
  );

  // Handle clearing the attached header image
  const handleClearImage = useCallback(() => {
    setImageUri(null);
    setShowAttachmentSheet(false);
  }, []);

  // Handle selecting a new header image
  const handleImageSelect = useCallback(
    (intents: Attachment.UploadIntent[]) => {
      // We only allow image uploads, so we can simplify and only handle images
      // here.
      const assets = Attachment.UploadIntent.extractImagePickerAssets(intents);
      if (assets.length > 0) {
        setImageUri(assets[0].uri);
      }
      setShowAttachmentSheet(false);
    },
    []
  );

  const handleInlineImageSelect = useCallback(
    async (intents: Attachment.UploadIntent[]) => {
      // We only allow image uploads, so we can simplify and only handle images
      // here.
      const assets = Attachment.UploadIntent.extractImagePickerAssets(intents);
      const activeEditor = enrichedInputEnabled
        ? enrichedEditorRef.current?.editor
        : editorRef.current?.editor;
      if (assets.length > 0 && activeEditor) {
        const asset = assets[0];

        // For inline images in notebooks, we need to upload the image first
        // then insert the uploaded URL into the editor
        // IMPORTANT: We do NOT use uploadAssets because that adds to attachments
        // Instead, we upload directly and wait for the URL
        try {
          // Upload the image directly without adding to attachments
          const uploadIntent =
            Attachment.UploadIntent.fromImagePickerAsset(asset);
          await uploadAssetToStorage(uploadIntent, true);

          if (!isMountedRef.current) return;

          // Wait for the upload to complete and get the S3 URL
          const uploadStates = await waitForUploads([
            Attachment.UploadIntent.extractKey(uploadIntent),
          ]);

          // Check again after await
          if (!isMountedRef.current) return;

          const uploadState = uploadStates[asset.uri];

          const currentEditor = enrichedInputEnabled
            ? enrichedEditorRef.current?.editor
            : editorRef.current?.editor;
          if (uploadState?.status === 'success' && currentEditor) {
            if (!enrichedInputEnabled) {
              const savedSelection = inlineImageSelectionRef.current;
              if (savedSelection) {
                currentEditor.focus();
                currentEditor.setSelection(
                  savedSelection.from,
                  savedSelection.to
                );
              }
            }

            // Insert the S3 URL into the editor
            const s3Url = uploadState.remoteUri;
            (currentEditor as any).setImage(s3Url, asset.width, asset.height);
            inlineImageSelectionRef.current = null;
          } else if (isMountedRef.current) {
            logger.trackError('notebook:inline-image:upload-failure', {
              uploadState,
            });
            showToast({
              message: 'Failed to upload image. Please try again.',
              duration: 3000,
            });
          }
        } catch (error) {
          inlineImageSelectionRef.current = null;
          if (isMountedRef.current) {
            logger.trackError('notebook:inline-image:upload-error', error);
            showToast({
              message:
                'Error uploading image. Please check your connection and try again.',
              duration: 3000,
            });
          }
        }
      }

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setShowInlineImageSheet(false);
      }
    },
    [showToast, enrichedInputEnabled]
  );

  // Handle images pasted into the enriched editor
  const handlePasteImages = useCallback(
    async (images: PastedImage[]) => {
      if (images.length === 0) return;

      const image = images[0];
      const editor = enrichedEditorRef.current?.editor;
      if (!editor) return;

      try {
        const uploadIntent = Attachment.UploadIntent.fromImagePickerAsset({
          uri: image.uri,
          width: image.width,
          height: image.height,
          mimeType: image.type,
        } as any);
        await uploadAssetToStorage(uploadIntent, true);

        if (!isMountedRef.current) return;

        const uploadStates = await waitForUploads([
          Attachment.UploadIntent.extractKey(uploadIntent),
        ]);

        if (!isMountedRef.current) return;

        const uploadState = uploadStates[image.uri];
        const currentEditor = enrichedEditorRef.current?.editor;

        if (uploadState?.status === 'success' && currentEditor) {
          (currentEditor as any).setImage(
            uploadState.remoteUri,
            image.width,
            image.height
          );
        } else if (isMountedRef.current) {
          logger.trackError('notebook:paste-image:upload-failure', {
            uploadState,
          });
          showToast({
            message: 'Failed to upload pasted image. Please try again.',
            duration: 3000,
          });
        }
      } catch (error) {
        if (isMountedRef.current) {
          logger.trackError('notebook:paste-image:upload-error', error);
          showToast({
            message: 'Error uploading pasted image.',
            duration: 3000,
          });
        }
      }
    },
    [showToast]
  );

  // Update image URI when editing post changes
  useEffect(() => {
    setImageUri(editingPost?.image || null);
  }, [editingPost?.id, editingPost?.image]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear attachments when component unmounts to prevent stale attachments
      // from appearing in other inputs that share the same attachment context
      if (editingPost) {
        clearAttachments();
      }
    };
  }, [editingPost, clearAttachments]);

  const toolbarItems = useMemo((): ToolbarItem[] => {
    const imageButton: ToolbarItem = {
      onPress:
        ({ editorState }) =>
        () => {
          inlineImageSelectionRef.current = {
            from: editorState.selection.from,
            to: editorState.selection.to,
          };
          setShouldBlur(true);
          setShowInlineImageSheet(true);
        },
      active: () => false,
      disabled: () => false,
      icon: 'Camera',
    };

    const markdownToggle: ToolbarItem = {
      onPress: () => () => handleMarkdownToggle(),
      active: () => isMarkdownMode,
      disabled: () => false,
      icon: 'Markdown',
    };

    const items = [...DEFAULT_TOOLBAR_ITEMS];
    // Between the Heading and Code buttons
    items.splice(5, 0, imageButton);
    // Add Markdown toggle at the beginning if feature flag is enabled
    if (markdownNotebooksEnabled) {
      items.unshift(markdownToggle);
    }
    return items;
  }, [
    isMarkdownMode,
    handleMarkdownToggle,
    markdownNotebooksEnabled,
    setShouldBlur,
  ]);

  // Toolbar items for enriched editor — exclude items that rely on tentap-only
  // capabilities (Undo, Redo, Indent/Outdent), add inline image button
  const enrichedToolbarItems = useMemo((): ToolbarItem[] => {
    const unsupported = new Set([
      'Undo',
      'Redo',
      'IndentIncrease',
      'IndentDecrease',
    ]);
    const items = DEFAULT_TOOLBAR_ITEMS.filter((i) => !unsupported.has(i.icon));

    const imageButton: ToolbarItem = {
      onPress: () => () => setShowInlineImageSheet(true),
      active: () => false,
      disabled: () => false,
      icon: 'Camera',
    };
    // Insert after Heading button
    const headingIdx = items.findIndex((i) => i.icon === 'Heading');
    items.splice(headingIdx + 1, 0, imageButton);

    return items;
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        width: '100%',
      }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View flex={1} flexDirection="column">
        {__DEV__ && (
          <Text
            fontSize={10}
            color="$tertiaryText"
            paddingHorizontal="$l"
            paddingTop="$xs"
          >
            {enrichedInputEnabled ? 'enriched' : isMarkdownMode ? 'markdown' : 'tiptap'}
          </Text>
        )}
        {channelType === 'notebook' && (
          <>
            <View padding="$m" paddingBottom="$s">
              <Input
                size="$xl"
                height={'$4xl'}
                width="100%"
                borderColor="transparent"
                placeholder="New Title"
                placeholderTextColor={'$tertiaryText'}
                onChangeText={setTitle}
                value={title}
              />
              <XStack
                height={'$4xl'}
                alignItems="center"
                paddingHorizontal="$l"
              >
                {imageUri ? (
                  <XStack height="100%" alignItems="center" gap="$s">
                    <Image
                      source={{ uri: imageUri }}
                      width="$3xl"
                      height="$3xl"
                      borderRadius="$m"
                    />
                    <TouchableOpacity
                      onPress={() => setShowAttachmentSheet(true)}
                    >
                      <XStack alignItems="center" gap="$xs">
                        <Icon type="Attachment" size="$m" />
                        <View>
                          <Text>Edit header image</Text>
                        </View>
                      </XStack>
                    </TouchableOpacity>
                  </XStack>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowAttachmentSheet(true)}
                  >
                    <XStack alignItems="center" gap="$xs">
                      <Icon type="Attachment" size="$m" />
                      <View>
                        <Text>Add header image</Text>
                      </View>
                    </XStack>
                  </TouchableOpacity>
                )}
              </XStack>
            </View>
          </>
        )}

        <View flex={1}>
          {!isWindowNarrow && channelType === 'notebook' && (
            <>
              {isMarkdownMode && markdownNotebooksEnabled ? (
                <XStack
                  paddingHorizontal="$m"
                  paddingVertical="$s"
                  borderBottomWidth={1}
                  borderBottomColor="$border"
                  backgroundColor="$background"
                >
                  <TouchableOpacity onPress={handleMarkdownToggle}>
                    <XStack alignItems="center" gap="$s" padding="$s">
                      <Icon
                        type="Markdown"
                        size="$m"
                        color={
                          isMarkdownMode
                            ? '$positiveActionText'
                            : '$primaryText'
                        }
                      />
                      <Text size="$label/s" color="$secondaryText">
                        Switch to Rich Text
                      </Text>
                    </XStack>
                  </TouchableOpacity>
                </XStack>
              ) : enrichedInputEnabled ? (
                enrichedEditorRef.current?.editor && enrichedEditorState && (
                  <FormattingToolbar
                    editor={enrichedEditorRef.current.editor}
                    editorState={enrichedEditorState}
                    hidden={false}
                    items={enrichedToolbarItems}
                    style={{
                      borderWidth: 0,
                      borderTopWidth: 0,
                      borderBottomWidth: 1,
                      borderRadius: 0,
                      backgroundColor: theme.background.val,
                    }}
                  />
                )
              ) : (
                editorRef.current?.editor && (
                  <InputToolbar
                    editor={editorRef.current.editor}
                    hidden={false}
                    items={toolbarItems}
                    style={{
                      borderWidth: 0,
                      borderTopWidth: 0,
                      borderBottomWidth: 1,
                      borderRadius: 0,
                      backgroundColor: theme.background.val,
                    }}
                  />
                )
              )}
            </>
          )}
          {isMarkdownMode ? (
            <MarkdownEditor
              value={markdownContent}
              onChange={setMarkdownContent}
              placeholder="Write your content in Markdown..."
              testID="BigInputMarkdownEditor"
            />
          ) : enrichedInputEnabled ? (
            <>
              <EnrichedNoteInput
                ref={enrichedEditorRef}
                initialHtml={enrichedInitialHtml}
                onChangeHtml={setEnrichedHtml}
                onEditorStateChange={setEnrichedEditorState}
                onPasteImages={handlePasteImages}
                onStartMention={handleStartMention}
                onChangeMention={handleChangeMention}
                onEndMention={handleEndMention}
                placeholder="Write your note..."
                testID="BigInputEnrichedEditor"
                style={{
                  flex: 1,
                  width: '100%',
                  backgroundColor: theme.background.val,
                  padding: 16,
                }}
              />
              {mentionActive && mentionOptions.length > 0 && (
                <View
                  position="absolute"
                  bottom={0}
                  left={0}
                  right={0}
                  zIndex={1000}
                  backgroundColor="$background"
                  borderTopWidth={1}
                  borderTopColor="$border"
                  maxHeight={300}
                >
                  <MentionPopup
                    options={mentionOptions}
                    onPress={handleSelectMention}
                    matchText={mentionSearchText}
                  />
                </View>
              )}
            </>
          ) : (
            <MessageInput
              ref={editorRef}
              sendPostFromDraft={sendPostFromDraft}
              channelId={channelId}
              channelType={channelType}
              editingPost={editingPost}
              setShouldBlur={setShouldBlur}
              {...props}
              groupMembers={groupMembers}
              groupRoles={groupRoles}
              storeDraft={storeDraft}
              getDraft={getDraft}
              draftType={draftType}
              clearDraft={clearDraft}
              frameless={true}
              bigInput={true}
              shouldAutoFocus={true}
              showInlineAttachments={channelType === 'gallery'}
              onEditorContentChange={handleEditorContentChanged}
              onEditorStateChange={handleEditorStateChange}
              title={title}
              image={
                imageUri ? { uri: imageUri, height: 0, width: 0 } : undefined
              }
              paddingHorizontal="$l"
            />
          )}
        </View>
      </View>

      {channelType === 'notebook' && (
        <>
          {isWindowNarrow && showFormatMenu && (
            <View
              position="absolute"
              bottom={insets.bottom + 16}
              right={64}
              zIndex={1000}
              width={isMarkdownMode ? 180 : 310}
              shadowColor={theme.primaryText.val}
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={4}
              backgroundColor={theme.background.val}
              borderColor={theme.border.val}
              borderWidth={1}
              borderRadius={getTokenValue('$l', 'radius')}
            >
              {isMarkdownMode && markdownNotebooksEnabled ? (
                <TouchableOpacity onPress={handleMarkdownToggle}>
                  <XStack
                    alignItems="center"
                    gap="$s"
                    padding="$m"
                    justifyContent="center"
                  >
                    <Icon
                      type="Markdown"
                      size="$m"
                      color="$positiveActionText"
                    />
                    <Text size="$label/s" color="$secondaryText">
                      Switch to Rich Text
                    </Text>
                  </XStack>
                </TouchableOpacity>
              ) : enrichedInputEnabled ? (
                enrichedEditorRef.current?.editor && enrichedEditorState && (
                  <FormattingToolbar
                    editor={enrichedEditorRef.current.editor}
                    editorState={enrichedEditorState}
                    hidden={false}
                    items={enrichedToolbarItems}
                    style={{
                      borderWidth: 0,
                      borderTopWidth: 0,
                      borderBottomWidth: 0,
                      borderRadius: getTokenValue('$l', 'radius'),
                      backgroundColor: theme.background.val,
                    }}
                  />
                )
              ) : (
                editorRef.current?.editor && (
                  <InputToolbar
                    editor={editorRef.current.editor}
                    hidden={false}
                    items={toolbarItems}
                    style={{
                      borderWidth: 0,
                      borderTopWidth: 0,
                      borderBottomWidth: 0,
                      borderRadius: getTokenValue('$l', 'radius'),
                      backgroundColor: theme.background.val,
                    }}
                  />
                )
              )}
            </View>
          )}
          {isWindowNarrow && (editorRef.current?.editor || isMarkdownMode || enrichedInputEnabled) && (
            <Button.Frame
              position="absolute"
              bottom={insets.bottom + 16}
              right={16}
              zIndex={200}
              backgroundColor={'$background'}
              shadowColor={'$primaryText'}
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={4}
              onPress={() => setShowFormatMenu(!showFormatMenu)}
            >
              {showFormatMenu ? (
                <Icon type="Close" size="$l" color="$primaryText" />
              ) : (
                <Icon type="Italic" size="$l" color="$primaryText" />
              )}
            </Button.Frame>
          )}
        </>
      )}

      {channelType === 'notebook' && showAttachmentSheet && (
        <AttachmentSheet
          isOpen={showAttachmentSheet}
          onOpenChange={setShowAttachmentSheet}
          onAttach={handleImageSelect}
          showClearOption={!!imageUri}
          onClearAttachments={handleClearImage}
          mediaType="image"
        />
      )}

      {channelType === 'notebook' && showInlineImageSheet && (
        <AttachmentSheet
          isOpen={showInlineImageSheet}
          onOpenChange={setShowInlineImageSheet}
          onAttach={handleInlineImageSelect}
          showClearOption={false}
          mediaType="image"
        />
      )}
    </KeyboardAvoidingView>
  );
}

function contentIsEmpty(content?: object): boolean {
  try {
    const jsonAny = content as any;

    // More careful content check that handles edge cases better
    if (!jsonAny.content) return true;
    if (jsonAny.content.length === 0) return true;

    // Special case for a single empty paragraph
    if (
      jsonAny.content.length === 1 &&
      jsonAny.content[0].type === 'paragraph'
    ) {
      // Consider it empty if the paragraph has no content array
      if (!jsonAny.content[0].content) return true;

      // Consider it empty if the content array is empty
      if (jsonAny.content[0].content.length === 0) return true;

      // Check if there's only a single text node with whitespace or empty text
      if (
        jsonAny.content[0].content.length === 1 &&
        jsonAny.content[0].content[0].type === 'text'
      ) {
        const text = jsonAny.content[0].content[0].text || '';
        return text.trim() === '';
      }
    }

    // If we get here, there's actual content
    return false;
  } catch (e) {
    logger.log('Error checking editor content:', e);
    return true;
  }
}
