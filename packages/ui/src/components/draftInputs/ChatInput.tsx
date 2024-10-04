import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageInput } from '../MessageInput';
import { ParentAgnosticKeyboardAvoidingView } from '../ParentAgnosticKeyboardAvoidingView';
import { DraftInputContext } from './shared';

export function ChatInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const {
    channel,
    clearDraft,
    editPost,
    editingPost,
    getDraft,
    group,
    send,
    setEditingPost,
    setShouldBlur,
    shouldBlur,
    storeDraft,
  } = draftInputContext;
  if (editingPost != null) {
    return null;
  }

  return (
    <SafeAreaView edges={['right', 'left', 'bottom']}>
      <ParentAgnosticKeyboardAvoidingView>
        <MessageInput
          shouldBlur={shouldBlur}
          setShouldBlur={setShouldBlur}
          send={send}
          channelId={channel.id}
          groupMembers={group?.members ?? []}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          editPost={editPost}
          channelType={channel.type}
          showInlineAttachments
          showAttachmentButton
        />
      </ParentAgnosticKeyboardAvoidingView>
    </SafeAreaView>
  );
}
