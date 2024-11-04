import { SafeAreaView } from 'react-native-safe-area-context';

import BareChatInput from '../BareChatInput';
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

  return (
    <SafeAreaView edges={['right', 'left', 'bottom']}>
      <ParentAgnosticKeyboardAvoidingView>
        <BareChatInput
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
          shouldAutoFocus={!!editingPost}
          showInlineAttachments
          showAttachmentButton
        />
      </ParentAgnosticKeyboardAvoidingView>
    </SafeAreaView>
  );
}
