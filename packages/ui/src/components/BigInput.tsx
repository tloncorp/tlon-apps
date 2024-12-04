// import { EditorBridge } from '@10play/tentap-editor';
import * as db from '@tloncorp/shared/db';
import { useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';
// TODO: replace input with our own input component
import { Input, View, YStack, getTokenValue } from 'tamagui';

import { ImageAttachment, useAttachmentContext } from '../contexts/attachment';
import AttachmentSheet from './AttachmentSheet';
import { Icon } from './Icon';
import { Image } from './Image';
import { MessageInput } from './MessageInput';
// import { InputToolbar } from './MessageInput/InputToolbar';
import { MessageInputProps } from './MessageInput/MessageInputBase';

// import { TlonEditorBridge } from './MessageInput/toolbarActions';

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
  const titleInputHeight = getTokenValue('$4xl', 'size');
  const imageButtonHeight = getTokenValue('$4xl', 'size');

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
              // editorRef.current?.editor?.blur();
            }}
          >
            {imageAttachment ? (
              <Image
                source={{
                  uri: imageAttachment.file.uri,
                }}
                contentFit="cover"
                height={imageButtonHeight}
                style={{
                  width: '100%',
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                }}
              />
            ) : (
              <View
                backgroundColor="$primaryText"
                width="100%"
                height={imageButtonHeight}
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
        />
      </View>
      {/* channelType === 'notebook' &&
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
        ) */}
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
