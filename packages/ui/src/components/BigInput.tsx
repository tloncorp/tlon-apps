// import { EditorBridge } from '@10play/tentap-editor';
import * as db from '@tloncorp/shared/dist/db';

// import { useMemo, useRef, useState } from 'react';
// import { Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
// import { TouchableOpacity } from 'react-native-gesture-handler';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// TODO: replace input with our own input component
// import { Image, Input, getToken } from 'tamagui';
// import { ImageAttachment, useAttachmentContext } from '../contexts/attachment';
import { View } from '../core';
import { MessageInputProps } from './MessageInput/MessageInputBase';

// import AttachmentSheet from './AttachmentSheet';
// import { Icon } from './Icon';
// import { MessageInput } from './MessageInput';
// import { InputToolbar } from './MessageInput/InputToolbar';
// import { TlonEditorBridge } from './MessageInput/toolbarActions';

// export function BigInput({
// channelType,
// channelId,
// groupMembers,
// shouldBlur,
// setShouldBlur,
// send,
// storeDraft,
// clearDraft,
// getDraft,
// editingPost,
// setEditingPost,
// editPost,
// setShowBigInput,
// placeholder,
// }: {
// channelType: db.ChannelType;
// } & MessageInputProps) {
// const [title, setTitle] = useState('');
// const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
// const editorRef = useRef<{
// editor: TlonEditorBridge | null;
// setEditor: (editor: object) => void;
// }>(null);
// const { top } = useSafeAreaInsets();
// const { width } = Dimensions.get('screen');
// const titleInputHeight = getToken('$4xl', 'size');
// const imageButtonHeight = getToken('$4xl', 'size');
// const keyboardVerticalOffset =
// Platform.OS === 'ios' ? top + titleInputHeight : top;

// const { attachments, attachAssets } = useAttachmentContext();
// const imageAttachment = useMemo(() => {
// return attachments.find(
// (attachment): attachment is ImageAttachment => attachment.type === 'image'
// );
// }, [attachments]);

// return (
// <YStack height="100%" width="100%">
// {channelType === 'notebook' && (
// <View
// style={[
// {
// position: 'absolute',
// top: 0,
// left: 0,
// width: '100%',
// height: imageButtonHeight,
// zIndex: 10,
// },
// ]}
// >
// <TouchableOpacity
// onPress={() => {
// setShowAttachmentSheet(true);
// editorRef.current?.editor?.blur();
// }}
// >
// {imageAttachment ? (
// <Image
// source={{ uri: imageAttachment.file.uri }}
// resizeMode="cover"
// style={{
// width: '100%',
// height: '100%',
// borderBottomLeftRadius: 16,
// borderBottomRightRadius: 16,
// }}
// />
// ) : (
// <View
// backgroundColor="$primaryText"
// width="100%"
// height="100%"
// borderBottomLeftRadius="$xl"
// borderBottomRightRadius="$xl"
// padding="$2xl"
// alignItems="center"
// justifyContent="center"
// gap="$l"
// >
// <Icon type="Camera" color="$background" />
// </View>
// )}
// </TouchableOpacity>
// {channelType === 'notebook' && (
// <View backgroundColor="$background" width="100%">
// <Input
// size="$xl"
// height={titleInputHeight}
// backgroundColor="$background"
// borderColor="transparent"
// placeholder="New Title"
// onChangeText={setTitle}
// />
// </View>
// )}
// </View>
// )}
// <ScrollView
// scrollEventThrottle={16}
// scrollToOverflowEnabled
// overScrollMode="always"
// contentContainerStyle={{
// paddingTop:
// channelType === 'notebook'
// ? titleInputHeight + imageButtonHeight
// : 0,
// }}
// >
// <MessageInput
// shouldBlur={shouldBlur}
// setShouldBlur={setShouldBlur}
// send={send}
// title={title}
// image={imageAttachment?.file ?? undefined}
// channelId={channelId}
// groupMembers={groupMembers}
// storeDraft={storeDraft}
// clearDraft={clearDraft}
// getDraft={getDraft}
// editingPost={editingPost}
// setEditingPost={setEditingPost}
// editPost={editPost}
// setShowBigInput={setShowBigInput}
// floatingActionButton
// showAttachmentButton={false}
// showInlineAttachments={false}
// backgroundColor="$background"
// paddingHorizontal="$m"
// placeholder={placeholder}
// bigInput
// channelType={channelType}
// ref={editorRef}
// />
// </ScrollView>
// {channelType === 'notebook' &&
// editorRef.current &&
// editorRef.current.editor && (
// <KeyboardAvoidingView
// behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
// keyboardVerticalOffset={keyboardVerticalOffset}
// style={{
// width,
// position: 'absolute',
// bottom: Platform.OS === 'ios' ? 0 : keyboardVerticalOffset,
// flex: 1,
// }}
// >
// <InputToolbar editor={editorRef.current.editor} />
// </KeyboardAvoidingView>
// )}
// {channelType === 'notebook' && showAttachmentSheet && (
// <AttachmentSheet
// showAttachmentSheet={showAttachmentSheet}
// setShowAttachmentSheet={setShowAttachmentSheet}
// setImage={attachAssets}
// />
// )}
// </YStack>
// );
// }

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
  return <View />;
}
