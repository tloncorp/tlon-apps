import { Dispatch, SetStateAction } from 'react';
import { AnimatePresence, View } from 'tamagui';

import { BigInput } from '../BigInput';
import { DraftInputContext } from './shared';

/**
 * `BigInput` set up for multiple kinds of draft inputs.
 */
export function DraftInputConnectedBigInput({
  draftInputContext,
  setShowBigInput,
}: {
  draftInputContext: DraftInputContext;
  // TODO: I think this is only used to dismiss big input on send - remove and just dismiss in `onSent` callback
  setShowBigInput: Dispatch<SetStateAction<boolean>>;
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
    <AnimatePresence>
      <View
        animation="simple"
        enterStyle={{
          y: 100,
          opacity: 0,
        }}
        exitStyle={{
          y: 100,
          opacity: 0,
        }}
        y={0}
        opacity={1}
        width="100%"
      >
        <BigInput
          channelType={channel.type}
          channelId={channel.id}
          groupMembers={group?.members ?? []}
          shouldBlur={shouldBlur}
          setShouldBlur={setShouldBlur}
          send={send}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          editPost={editPost}
          setShowBigInput={setShowBigInput}
          placeholder=""
        />
      </View>
    </AnimatePresence>
  );
}
