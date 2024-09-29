import { MessageInput } from '../MessageInput';
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
    onSent,
    send,
    setEditingPost,
    setShouldBlur,
    shouldBlur,
    storeDraft,
  } = draftInputContext;
  return (
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
      onSend={onSent}
      showInlineAttachments
      showAttachmentButton
    />
  );
}
