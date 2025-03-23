import * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, View, YStack, XStack, getTokenValue, Button } from 'tamagui';

import { useAttachmentContext } from '../contexts/attachment';
import { constructStory, Block } from '@tloncorp/shared/urbit/channel';
import { tiptap } from '@tloncorp/shared';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { ScreenHeader } from './ScreenHeader';
import AttachmentSheet from './AttachmentSheet';
import { MessageInput } from './MessageInput';
import { InputToolbar } from './MessageInput/InputToolbar.native';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import { TlonEditorBridge } from './MessageInput/toolbarActions.native';

export function BigInput({
  send,
  editPost,
  channelId,
  channelType,
  editingPost,
  setShowBigInput,
  ...props
}: MessageInputProps & {
  editPost?: (post: db.Post, story: any, replyTo?: string, metadata?: any) => Promise<void>;
  channelId: string;
  channelType: string;
  editingPost?: db.Post;
  setShowBigInput?: (show: boolean) => void;
}) {
  const [title, setTitle] = useState(editingPost?.title || '');
  const [imageUri, setImageUri] = useState<string | null>(editingPost?.image || null);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [hasContentChanges, setHasContentChanges] = useState(false);
  const [hasTitleChanges, setHasTitleChanges] = useState(false);
  const [hasImageChanges, setHasImageChanges] = useState(false);
  const editorRef = useRef<{ editor: TlonEditorBridge | null }>(null);
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('screen');
  const titleInputHeight = getTokenValue('$4xl', 'size');
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + titleInputHeight : insets.top;
  const { attachments, addAttachment, removeAttachment } = useAttachmentContext();

  // Track changes to the editor content
  useEffect(() => {
    const editor = editorRef.current?.editor;
    if (!editor) return;

    editor._onContentUpdate = async () => {
      const json = await editor.getJSON();
      if (!json) return;

      const inlines = tiptap.JSONToInlines(json);
      const story = constructStory(inlines);
      
      // Compare with original content if editing
      if (editingPost?.content) {
        const originalContent = editingPost.content as { story: any };
        setHasContentChanges(JSON.stringify(story) !== JSON.stringify(originalContent.story));
      } else {
        setHasContentChanges(true);
      }
    };

    return () => {
      if (editor) {
        editor._onContentUpdate = () => {};
      }
    };
  }, [editingPost?.content]);

  // Track changes to title and image
  useEffect(() => {
    if (!editingPost) {
      setHasTitleChanges(false);
      setHasImageChanges(false);
      return;
    }

    setHasTitleChanges(title !== editingPost.title);
    setHasImageChanges(imageUri !== editingPost.image);
  }, [title, imageUri, editingPost]);

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
      if (editingPost && editPost) {
        // If we're editing, use editPost with the correct parameters
        await editPost(editingPost, story, undefined, metadata);
      } else {
        // If it's a new post, use send
        await send(story, channelId, metadata);
      }

      // Clear the draft after successful save
      if (!editingPost && props.clearDraft) {
        await props.clearDraft(channelType === 'gallery' ? 'text' : undefined);
      }

      setTitle('');
      setImageUri(null);
      setShowBigInput?.(false);
    } catch (error) {
      console.error('Failed to save post:', error);
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
  ]);

  // Register the "Post" button in the header
  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="big-input-post"
          onPress={handleSend}
          disabled={!editorRef.current?.editor || (editingPost && !hasContentChanges && !hasTitleChanges && !hasImageChanges)}
          testID="BigInputPostButton"
        >
          {editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [handleSend, editingPost, hasContentChanges, hasTitleChanges, hasImageChanges]
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

  // Update Save button disabled state
  const isSaveDisabled = !hasContentChanges && !hasTitleChanges && !hasImageChanges;

  return (
    <YStack height="100%" width="100%">
      {channelType === 'notebook' && (
        <YStack paddingHorizontal="$2xl" paddingTop="$l" gap="$m">
          <XStack alignItems="center" justifyContent="space-between">
            <Input
              size="$xl"
              height={titleInputHeight}
              backgroundColor="$background"
              borderColor="transparent"
              placeholder="New Title"
              onChangeText={setTitle}
              value={title}
              flex={1}
            />
          </XStack>

          <XStack height={48} alignItems="center">
            {imageUri ? (
              <XStack
                height="100%"
                borderRadius="$m"
                overflow="hidden"
                alignItems="center"
                gap="$s"
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: 48, height: 48, borderRadius: 8 }}
                />
                <TouchableOpacity onPress={() => setShowAttachmentSheet(true)}>
                  <XStack alignItems="center" gap="$xs">
                    <Icon type="Camera" size="$s" />
                    <View>
                      <Text>Edit header image</Text>
                    </View>
                  </XStack>
                </TouchableOpacity>
              </XStack>
            ) : (
              <TouchableOpacity onPress={() => setShowAttachmentSheet(true)}>
                <XStack alignItems="center" gap="$xs">
                  <Icon type="Camera" size="$s" />
                  <View>
                    <Text>Add header image</Text>
                  </View>
                </XStack>
              </TouchableOpacity>
            )}
          </XStack>
        </YStack>
      )}

      <View
        flex={1}
        backgroundColor="$background"
        paddingHorizontal="$2xl"
        paddingTop="$m"
      >
        <MessageInput
          ref={editorRef}
          send={handleSend}
          channelId={channelId}
          channelType={channelType}
          editingPost={editingPost}
          {...props}
          clearDraft={props.clearDraft}
          frameless={true}
        />
      </View>

      {channelType === 'notebook' && editorRef.current?.editor && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={{
            width,
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 0 : keyboardVerticalOffset,
            flex: 1,
          }}
        >
          <InputToolbar editor={editorRef.current.editor} />
        </KeyboardAvoidingView>
      )}

      {channelType === 'notebook' && showAttachmentSheet && (
        <AttachmentSheet
          isOpen={showAttachmentSheet}
          onOpenChange={setShowAttachmentSheet}
          onAttachmentsSet={handleImageSelect}
          showClearOption={!!imageUri}
          onClearAttachments={handleClearImage}
        />
      )}
    </YStack>
  );
}
