import { createDevLogger, tiptap } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { constructStory } from '@tloncorp/shared/urbit/channel';
import {
  Button,
  Icon,
  Image,
  Text,
  View,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, XStack, getTokenValue, useTheme } from 'tamagui';

import AttachmentSheet from './AttachmentSheet';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { MessageInput } from './MessageInput';
import { InputToolbar } from './MessageInput/InputToolbar';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import { TlonEditorBridge } from './MessageInput/toolbarActions';
import { ScreenHeader } from './ScreenHeader';

const logger = createDevLogger('BigInput', false);

export function BigInput({
  send,
  editPost,
  channelId,
  channelType,
  editingPost,
  setShowBigInput,
  ...props
}: MessageInputProps & {
  editPost?: (
    post: db.Post,
    story: any,
    replyTo?: string,
    metadata?: any
  ) => Promise<void>;
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
  const [hasContentChanges, setHasContentChanges] = useState(false);
  const [hasTitleChanges, setHasTitleChanges] = useState(false);
  const [hasImageChanges, setHasImageChanges] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(!isWindowNarrow);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const editorRef = useRef<{ editor: TlonEditorBridge | null }>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [isEmpty, setIsEmpty] = useState(true);

  const handleEditorContentChanged = useCallback(
    (content?: object) => {
      const nextIsEmpty = contentIsEmpty(content);
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
    [editingPost?.content]
  );

  useEffect(() => {
    setHasTitleChanges(title !== editingPost?.title);
    setHasImageChanges(imageUri !== editingPost?.image);
  }, [title, imageUri, editingPost]);

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
    if (!editorRef.current?.editor) return;

    const json = await editorRef.current.editor.getJSON();
    const inlines = tiptap.JSONToInlines(json);
    const story = constructStory(inlines);

    // Create metadata for notebook posts with title and image
    const metadata: Record<string, any> = {};
    if (channelType === 'notebook') {
      if (title) {
        metadata.title = title;
      }

      // Always include image field for notebooks, even if null
      // This ensures we can clear an image by setting it to null
      metadata.image = imageUri;
    }

    try {
      // Store the channel type for later use after async operations
      const currentChannelType = channelType;
      const isGalleryText = currentChannelType === 'gallery';

      if (editingPost && editPost) {
        // If we're editing, use editPost with the correct parameters
        await editPost(editingPost, story, undefined, metadata);
      } else {
        // If it's a new post, use send
        await send(story, channelId, metadata);
      }

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

      // Clear the editor content before clearing drafts to prevent race conditions
      if (editorRef.current?.editor) {
        logger.log('Clearing editor content after save');
        editorRef.current.editor.setContent('');
      }

      // Clear the draft after successful save for all channel types
      if (!editingPost && props.clearDraft) {
        try {
          logger.log(
            `Clearing draft for ${isGalleryText ? 'gallery text' : currentChannelType}`
          );

          if (isGalleryText) {
            // For Gallery text posts, explicitly clear 'text' drafts
            await props.clearDraft('text');

            // If the gallery text draft persists, try calling with undefined as well
            setTimeout(async () => {
              if (props.clearDraft) {
                logger.log('Additional gallery draft clearing attempt');
                await props.clearDraft(undefined);
              }
            }, 100);
          } else {
            // For other channel types, don't specify to clear all drafts
            await props.clearDraft(undefined);
          }
          logger.log('Draft cleared successfully');
        } catch (e) {
          logger.error('Error clearing draft:', e);
        }
      }
    } catch (error) {
      logger.error('Failed to save post:', error);
      // Don't clear draft if save failed
    }
  }, [
    send,
    editPost,
    channelId,
    title,
    imageUri,
    channelType,
    setShowBigInput,
    editingPost,
    props.clearDraft,
    setShowFormatMenu,
  ]);

  // Register the "Post" button in the header
  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="big-input-post"
          onPress={handleSend}
          testID="BigInputPostButton"
          disabled={!isButtonEnabled}
        >
          {editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [handleSend, editingPost, isButtonEnabled]
    )
  );

  // Handle clearing the attached header image
  const handleClearImage = useCallback(() => {
    setImageUri(null);
    setShowAttachmentSheet(false);
  }, []);

  // Handle selecting a new header image
  const handleImageSelect = useCallback((assets: ImagePickerAsset[]) => {
    if (assets.length > 0) {
      setImageUri(assets[0].uri);
    }
    setShowAttachmentSheet(false);
  }, []);

  // Update image URI when editing post changes
  useEffect(() => {
    setImageUri(editingPost?.image || null);
  }, [editingPost?.id, editingPost?.image]);

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

        <View>
          {!isWindowNarrow &&
            editorRef.current?.editor &&
            channelType === 'notebook' && (
              <InputToolbar
                editor={editorRef.current?.editor}
                hidden={false}
                style={{
                  borderWidth: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 1,
                  borderRadius: 0,
                  backgroundColor: theme.background.val,
                }}
              />
            )}
          <MessageInput
            ref={editorRef}
            send={handleSend}
            channelId={channelId}
            channelType={channelType}
            editingPost={editingPost}
            {...props}
            clearDraft={props.clearDraft}
            frameless={true}
            bigInput={true}
            shouldAutoFocus={true}
            onEditorContentChange={handleEditorContentChanged}
            title={title}
            image={
              imageUri ? { uri: imageUri, height: 0, width: 0 } : undefined
            }
            paddingHorizontal="$l"
          />
        </View>
      </View>

      {channelType === 'notebook' && editorRef.current?.editor && (
        <>
          {isWindowNarrow && showFormatMenu && (
            <View
              position="absolute"
              bottom={insets.bottom + 16}
              right={64}
              zIndex={1000}
              width={310}
              shadowColor={theme.primaryText.val}
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={4}
              backgroundColor={theme.background.val}
              borderColor={theme.border.val}
              borderWidth={1}
              borderRadius={getTokenValue('$l', 'radius')}
            >
              <InputToolbar
                editor={editorRef.current?.editor}
                hidden={false}
                style={{
                  borderWidth: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                  borderRadius: getTokenValue('$l', 'radius'),
                  backgroundColor: theme.background.val,
                }}
              />
            </View>
          )}
          {isWindowNarrow && (
            <Button
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
            </Button>
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
