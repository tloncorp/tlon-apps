import * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, XStack, getTokenValue, useTheme } from 'tamagui';
import { Button } from '@tloncorp/ui';

import { constructStory } from '@tloncorp/shared/urbit/channel';
import { createDevLogger, tiptap } from '@tloncorp/shared';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { ScreenHeader } from './ScreenHeader';
import AttachmentSheet from './AttachmentSheet';
import { MessageInput } from './MessageInput';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import { TlonEditorBridge } from './MessageInput/toolbarActions.native';
import { InputToolbar } from './MessageInput/InputToolbar.native';

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
  const [contentEmpty, setContentEmpty] = useState(true);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const editorRef = useRef<{ editor: TlonEditorBridge | null }>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // Helper function to check if editor content is empty
  const checkEditorContentEmpty = useCallback(async () => {
    const editor = editorRef.current?.editor;
    if (!editor) return true;
    
    try {
      const json = await editor.getJSON();
      if (!json) return true;
      
      const jsonAny = json as any;
      
      // More careful content check that handles edge cases better
      if (!jsonAny.content) return true;
      if (jsonAny.content.length === 0) return true;
      
      // Special case for a single empty paragraph
      if (jsonAny.content.length === 1 && 
          jsonAny.content[0].type === 'paragraph') {
        
        // Consider it empty if the paragraph has no content array
        if (!jsonAny.content[0].content) return true;
        
        // Consider it empty if the content array is empty
        if (jsonAny.content[0].content.length === 0) return true;
        
        // Check if there's only a single text node with whitespace or empty text
        if (jsonAny.content[0].content.length === 1 &&
            jsonAny.content[0].content[0].type === 'text') {
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
  }, []);

  // Helper function for checking content changes
  const checkContentChanges = useCallback(async () => {
    const editor = editorRef.current?.editor;
    if (!editor) {
      logger.log('No editor available for content check');
      return;
    }
    
    try {
      const json = await editor.getJSON();
      if (!json) {
        logger.log('Editor returned no JSON');
        return;
      }
      
      const isEmpty = await checkEditorContentEmpty();
      logger.log('Content empty check:', isEmpty);
      setContentEmpty(isEmpty);
      
      const inlines = tiptap.JSONToInlines(json);
      const story = constructStory(inlines);
      
      if (editingPost?.content) {
        const originalContent = editingPost.content as { story: any };
        const hasChanges = JSON.stringify(story) !== JSON.stringify(originalContent.story);
        logger.log('Content changes:', hasChanges);
        setHasContentChanges(hasChanges);
      } else {
        logger.log('New content, not empty:', !isEmpty);
        setHasContentChanges(!isEmpty);
      }
    } catch (e) {
      logger.log('Error in checkContentChanges:', e);
    }
  }, [checkEditorContentEmpty, editingPost?.content]);

  // Run initial content check when the editor is ready
  useEffect(() => {
    if (!editorRef.current?.editor) {
      logger.log('Editor not ready for initial check');
      return;
    }
    
    logger.log('Running initial content check');
    const timer = setTimeout(() => {
      checkContentChanges();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [editorRef.current?.editor, checkContentChanges]);

  // Run more frequent content checks when focused
  useEffect(() => {
    if (!isEditorFocused || !editorRef.current?.editor) return;
    
    // Check content more frequently when the editor is focused
    const checkInterval = setInterval(() => {
      checkContentChanges();
    }, 100);
    
    return () => clearInterval(checkInterval);
  }, [isEditorFocused, checkContentChanges]);

  // Track changes to the editor content
  useEffect(() => {
    const editor = editorRef.current?.editor;
    if (!editor) {
      logger.log('No editor available for setting up content tracking');
      return;
    }

    logger.log('Setting up editor content tracking');
    
    // Immediately update on any content change
    editor._onContentUpdate = async () => {
      logger.log('Content updated, checking content state');
      await checkContentChanges();
    };
    
    // Force an immediate check when the editor is set up
    setTimeout(() => {
      checkContentChanges();
    }, 50);

    return () => {
      if (editor) {
        editor._onContentUpdate = () => { };
      }
    };
  }, [checkContentChanges]);

  // Force content check with minimal delay when editor gets focus
  useEffect(() => {
    if (isEditorFocused && editorRef.current?.editor) {
      logger.log('Editor focused, checking content');
      setTimeout(() => {
        checkContentChanges();
      }, 50);
    }
  }, [isEditorFocused, checkContentChanges]);

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
        logger.log('Error checking editor focus state', e);
      }
    }, 500);

    return () => {
      clearInterval(checkFocusInterval);
    };
  }, [showFormatMenu]);

  // Track changes to title and image
  useEffect(() => {
    if (!editingPost) {
      const hasTitleChanged = !!title;
      const hasImageChanged = !!imageUri;
      logger.log('New post - title:', hasTitleChanged, 'image:', hasImageChanged);
      setHasTitleChanges(hasTitleChanged);
      setHasImageChanges(hasImageChanged);
      return;
    }

    const hasTitleChanged = title !== editingPost.title;
    const hasImageChanged = imageUri !== editingPost.image;
    logger.log('Editing post - title changed:', hasTitleChanged, 'image changed:', hasImageChanged);
    setHasTitleChanges(hasTitleChanged);
    setHasImageChanges(hasImageChanged);
  }, [title, imageUri, editingPost]);

  // Determine if the post/save button should be enabled - with direct content check
  useEffect(() => {
    const updateButtonState = async () => {
      const isEmpty = await checkEditorContentEmpty();
      
      let enabled = false;
      
      if (editingPost) {
        // For editing: enable if anything has changed
        enabled = hasContentChanges || hasTitleChanges || hasImageChanges;
        logger.log('Button enabled (editing):', enabled, 
          '- content:', hasContentChanges, 
          'title:', hasTitleChanges, 
          'image:', hasImageChanges);
      } else {
        // For new posts
        if (channelType === 'notebook') {
          // For notebooks: need both title and content
          enabled = !isEmpty && !!title;
          logger.log('Button enabled (new notebook):', enabled, 
            '- content:', !isEmpty, 
            'title:', !!title);
        } else {
          // For other types: just need content
          enabled = !isEmpty;
          logger.log('Button enabled (new post):', enabled, 
            '- content:', !isEmpty);
        }
      }
      
      setIsButtonEnabled(enabled);
    };
    
    // Ensure we update the button state whenever any relevant state changes
    updateButtonState();
  }, [
    editingPost, 
    hasContentChanges, 
    hasTitleChanges, 
    hasImageChanges, 
    title, 
    channelType,
    checkEditorContentEmpty
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

      logger.log(`Post/save successful for channel type: ${currentChannelType}`);
      
      // Clear all state first
      setTitle('');
      setImageUri(null);
      setContentEmpty(true);
      setHasContentChanges(false);
      setHasTitleChanges(false);
      setHasImageChanges(false);
      setShowFormatMenu(false);

      // Clear the editor content before clearing drafts to prevent race conditions
      if (editorRef.current?.editor) {
        logger.log('Clearing editor content after save');
        await editorRef.current.editor.setContent('');
      }
      
      // Clear the draft after successful save for all channel types
      if (!editingPost && props.clearDraft) {
        try {
          logger.log(`Clearing draft for ${isGalleryText ? 'gallery text' : currentChannelType}`);
          
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
      
      // Force a re-check of content after everything is cleared
      setTimeout(async () => {
        // Double check that content is still empty after all operations
        if (editorRef.current?.editor) {
          const isEmpty = await checkEditorContentEmpty();
          logger.log('Final content empty check:', isEmpty);
          
          // If somehow content got restored, try clearing again
          if (!isEmpty) {
            logger.log('Content was restored after clearing, clearing again');
            editorRef.current.editor.setContent('');
            await checkContentChanges();
            
            // For gallery text posts, make an additional attempt to clear drafts
            if (isGalleryText && props.clearDraft) {
              logger.log('Making final attempt to clear gallery text draft');
              try {
                await props.clearDraft('text');
                await props.clearDraft(undefined);
              } catch (e) {
                logger.error('Error in final draft clearing:', e);
              }
            }
          }
        }

        // Close the big input last
        setShowBigInput?.(false);
      }, 500); // Increased timeout to ensure all operations complete
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
    checkContentChanges,
    checkEditorContentEmpty,
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

  // A separate effect to check content shortly after component mount
  // This catches cases where content might be loaded from drafts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorRef.current?.editor) {
        logger.log('Delayed content check for drafts');
        checkContentChanges();
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [checkContentChanges]);

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
              borderColor: theme.border.val,
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
          >
            {showFormatMenu ? (
              <Icon type="Close" size="$l" color="$primaryText" />
            ) : (
              <Icon type="Italic" size="$l" color="$primaryText" />
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
