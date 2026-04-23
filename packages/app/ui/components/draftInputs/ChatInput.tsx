import { useIsWindowNarrow } from '@tloncorp/ui';
import { ParentAgnosticKeyboardAvoidingView } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isWeb } from 'tamagui';

import { useStore } from '../../contexts/storeContext';
import BareChatInput from '../BareChatInput';
import { DraftInputContext } from './shared';

export function ChatInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const store = useStore();
  const {
    channel,
    clearDraft,
    draftInputRef,
    editingPost,
    getDraft,
    group,
    sendPostFromDraft,
    setEditingPost,
    setShouldBlur,
    shouldBlur,
    storeDraft,
  } = draftInputContext;

  const isWindowNarrow = useIsWindowNarrow();
  const showWayfindingTooltip = store.useShowChatInputWayfinding(channel.id);

  return (
    <SafeAreaView edges={['right', 'left', 'bottom']}>
      <ParentAgnosticKeyboardAvoidingView>
        <BareChatInput
          ref={draftInputRef}
          shouldBlur={shouldBlur}
          setShouldBlur={setShouldBlur}
          sendPostFromDraft={sendPostFromDraft}
          groupId={channel.groupId}
          channelId={channel.id}
          groupMembers={group?.members ?? []}
          groupRoles={group?.roles ?? []}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          channelType={channel.type}
          shouldAutoFocus={!!editingPost || (isWeb && !isWindowNarrow)}
          showInlineAttachments
          showAttachmentButton
          showWayfindingTooltip={showWayfindingTooltip}
        />
      </ParentAgnosticKeyboardAvoidingView>
    </SafeAreaView>
  );
}
