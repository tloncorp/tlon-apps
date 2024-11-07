import * as db from '@tloncorp/shared/db';
import { useMemo, useRef, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// TODO: replace input with our own input component
import { Input, View, YStack, getTokenValue } from 'tamagui';

import { ImageAttachment, useAttachmentContext } from '../contexts/attachment';
import AttachmentSheet from './AttachmentSheet';
import { Icon } from './Icon';
import { Image } from './Image';
import { MessageInput } from './MessageInput';
import { InputToolbar } from './MessageInput/InputToolbar.native';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import { TlonEditorBridge } from './MessageInput/toolbarActions.native';

export function BigInput({
  channelType,
  channelId,
  groupMembers,
  shouldBlur,
  setShouldBlur,
  send,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  setShowBigInput,
  placeholder,
}: {
  channelType: db.ChannelType;
} & MessageInputProps) {
  const [title, setTitle] = useState(editingPost?.title ?? '');
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const editorRef = useRef<{
    editor: TlonEditorBridge | null;
  }>(null);
  const { top } = useSafeAreaInsets();
  const { width } = Dimensions.get('screen');
  const titleInputHeight = getTokenValue('$4xl', 'size');
  const imageButtonHeight = getTokenValue('$4xl', 'size');
  const keyboardVerticalOffset =
    Platform.OS === 'ios' ? top + titleInputHeight : top;

  const { attachments, attachAssets } = useAttachmentContext();
  const imageAttachment = useMemo(() => {
    if (attachments.length > 0) {
      return attachments.find(
        (attachment): attachment is ImageAttachment =>
          attachment.type === 'image'
      );
    }

    if (editingPost?.image) {
      return {
        type: 'image',
        file: {
          uri: editingPost.image,
          width: 0,
          height: 0,
        },
      };
    }

    return null;
  }, [attachments, editingPost]);

  return (
    <YStack height="100%" width="100%">
      {channelType === 'notebook' && (
        <View
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height={imageButtonHeight}
          zIndex={10}
        >
          <TouchableOpacity
            onPress={() => {
              setShowAttachmentSheet(true);
              editorRef.current?.editor?.blur();
            }}
          >
            {imageAttachment ? (
              <Image
                source={{ uri: imageAttachment.file.uri }}
                contentFit="cover"
                style={{
                  width: '100%',
                  height: '100%',
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                }}
              />
            ) : (
              <View
                backgroundColor="$primaryText"
                width="100%"
                height="100%"
                borderBottomLeftRadius="$xl"
                borderBottomRightRadius="$xl"
                padding="$2xl"
                alignItems="center"
                justifyContent="center"
                gap="$l"
              >
                <Icon type="Camera" color="$background" />
              </View>
            )}
          </TouchableOpacity>
          <View backgroundColor="$background" width="100%">
            <Input
              size="$xl"
              height={titleInputHeight}
              backgroundColor="$background"
              borderColor="transparent"
              placeholder="New Title"
              onChangeText={setTitle}
              value={title}
            />
          </View>
        </View>
      )}
      <View
        paddingTop={
          channelType === 'notebook' ? titleInputHeight + imageButtonHeight : 0
        }
      >
        <MessageInput
          shouldBlur={shouldBlur}
          setShouldBlur={setShouldBlur}
          send={send}
          title={title}
          image={imageAttachment?.file ?? undefined}
          channelId={channelId}
          groupMembers={groupMembers}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          editPost={editPost}
          setShowBigInput={setShowBigInput}
          floatingActionButton
          showAttachmentButton={false}
          showInlineAttachments={false}
          backgroundColor="$background"
          paddingHorizontal="$m"
          placeholder={placeholder}
          bigInput
          channelType={channelType}
          shouldAutoFocus
          draftType={channelType === 'gallery' ? 'text' : undefined}
          ref={editorRef}
        />
      </View>
      {channelType === 'notebook' &&
        editorRef.current &&
        editorRef.current.editor && (
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
          onAttachmentsSet={attachAssets}
        />
      )}
    </YStack>
  );
}
