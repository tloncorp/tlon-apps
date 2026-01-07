import { Dispatch, SetStateAction } from 'react';
import { View } from 'tamagui';

import { BigInput } from '../BigInput';
import { DraftInputContext } from './shared';

/**
 * `BigInput` set up for multiple kinds of draft inputs.
 */
export function DraftInputConnectedBigInput({
  draftInputContext,
  setShowBigInput,

  /**
   * Use this prop instead of unmounting the component to enable the default
   * presence animation.
   */
  hidden = false,
  overrideChannelType,
}: {
  draftInputContext: DraftInputContext;
  // TODO: I think this is only used to dismiss big input on send - remove and just dismiss in `onSent` callback
  setShowBigInput: Dispatch<SetStateAction<boolean>>;
  hidden?: boolean;
  overrideChannelType?: 'notebook' | 'gallery';
}) {
  const {
    channel,
    clearDraft,
    editingPost,
    getDraft,
    group,
    legacy_sendPost: sendPost,
    sendPostFromDraft,
    setEditingPost,
    setShouldBlur,
    shouldBlur,
    storeDraft,
  } = draftInputContext;

  if (hidden) {
    return null;
  }

  return (
    <View opacity={1} width="100%" height={'100%'}>
      <BigInput
        channelType={
          overrideChannelType == null ? channel.type : overrideChannelType
        }
        channelId={channel.id}
        groupMembers={group?.members ?? []}
        groupRoles={group?.roles ?? []}
        shouldBlur={shouldBlur}
        setShouldBlur={setShouldBlur}
        sendPost={sendPost}
        sendPostFromDraft={sendPostFromDraft}
        storeDraft={storeDraft}
        clearDraft={clearDraft}
        getDraft={getDraft}
        editingPost={editingPost}
        setEditingPost={setEditingPost}
        setShowBigInput={setShowBigInput}
        placeholder=""
      />
    </View>
  );
}
