import * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, XStack, getTokenValue } from 'tamagui';
import { Button } from '@tloncorp/ui';

import { constructStory } from '@tloncorp/shared/urbit/channel';
import { tiptap } from '@tloncorp/shared';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { ScreenHeader } from './ScreenHeader';
import AttachmentSheet from './AttachmentSheet';
import { MessageInput } from './MessageInput';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import { TlonEditorBridge } from './MessageInput/toolbarActions.native';
import { InputToolbar } from './MessageInput/InputToolbar.native';

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
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const editorRef = useRef<{ editor: TlonEditorBridge | null }>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const editor = editorRef.current?.editor;
    if (!editor) return;

    const checkFocusInterval = setInterval(async () => {
      try {
        const editorState = await editor.getEditorState();
        if (editorState?.isFocused !== undefined) {
          const newFocusState = editorState.isFocused;
          setIsEditorFocused(newFocusState);
          if (!newFocusState && showFormatMenu) {
            setShowFormatMenu(false);
          }
        }
      } catch (e) {
        console.log('Error checking editor focus state', e);
      }
    }, 500);

    return () => {
      clearInterval(checkFocusInterval);
    };
  }, [showFormatMenu]);

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
        editor._onContentUpdate = () => { };
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

      // Clear the editor content
      if (editorRef.current?.editor) {
        editorRef.current.editor.setContent('');
      }
      
      // Reset form state
      setTitle('');
      setImageUri(null);
      setShowFormatMenu(false);
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
    setShowFormatMenu,
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        width: '100%',
      }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={{
        flex: 1,
        flexDirection: 'column',
        position: 'relative',
      }}>
        {channelType === 'notebook' && (
          <View>
            <View style={{
              paddingHorizontal: getTokenValue('$m', 'space'),
              paddingTop: getTokenValue('$m', 'space'),
              paddingBottom: getTokenValue('$s', 'space'),
            }}>
              <Input
                size="$xl"
                height={getTokenValue('$4xl', 'size')}
                backgroundColor="$background"
                width="100%"
                borderColor="transparent"
                placeholder="New Title"
                onChangeText={setTitle}
                value={title}
              />

              <XStack height={getTokenValue('$4xl', 'size')} alignItems="center" paddingHorizontal="$l">
                {imageUri ? (
                  <XStack
                    height="100%"
                    alignItems="center"
                    gap="$s"
                  >
                    <Image
                      source={{ uri: imageUri }}
                      width="$3xl"
                      height="$3xl"
                      borderRadius="$m"
                    />
                    <TouchableOpacity onPress={() => setShowAttachmentSheet(true)}>
                      <XStack alignItems="center" gap="$xs">
                        <Icon type="Attachment" size="$m" />
                        <View>
                          <Text>Edit header image</Text>
                        </View>
                      </XStack>
                    </TouchableOpacity>
                  </XStack>
                ) : (
                  <TouchableOpacity onPress={() => setShowAttachmentSheet(true)}>
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
          </View>
        )}
        <View style={{
          flex: 1,
          marginTop: channelType === 'notebook' ? getTokenValue('$10xl', 'size') : 0,
        }}>
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
            title={title}
            image={imageUri ? { uri: imageUri, height: 0, width: 0 } : undefined}
            paddingHorizontal="$l"
          />
        </View>
      </View>

      {channelType === 'notebook' && editorRef.current?.editor && isEditorFocused && (
        <>
          {showFormatMenu && (
            <View style={{
              position: 'absolute',
              top: 300,
              right: 64,
              zIndex: 1000,
              borderRadius: 100,
              overflow: 'hidden',
              borderColor: getTokenValue('$gray100', 'color'),
              borderWidth: 1,
              width: 310,
            }}>
              <InputToolbar editor={editorRef.current?.editor} hidden={false} />
            </View>
          )}
          <Button
            position="absolute"
            top={300}
            right={16}
            borderRadius="$4xl"
            onPress={() => setShowFormatMenu(!showFormatMenu)}
            zIndex={200}
          >
            {showFormatMenu ? (
              <Icon type="Close" size="$l" />
            ) : (
              <Icon type="Italic" size="$l" />
            )}
          </Button>
        </>
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
    </KeyboardAvoidingView>
  );
}
