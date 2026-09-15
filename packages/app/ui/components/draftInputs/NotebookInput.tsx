import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import type { ScreenHeaderAction } from '../ScreenHeader';
import WayfindingNotices from '../Wayfinding/Notices';
import { DraftInputConnectedBigInput } from './DraftInputConnectedBigInput';
import { DraftInputContext } from './shared';

export function NotebookInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const { draftInputRef, editingPost, onPresentationModeChange } =
    draftInputContext;
  const [showBigInput, setShowBigInput] = useState(false);

  // Notify host when presenting/dismissing big input
  useEffect(() => {
    onPresentationModeChange?.(showBigInput ? 'fullscreen' : 'inline');
  }, [showBigInput, onPresentationModeChange]);

  // Use big input when editing a post
  const isEditingPost = editingPost != null;
  useEffect(() => {
    setShowBigInput(isEditingPost);
  }, [isEditingPost]);

  const handleAdd = useCallback(() => {
    setShowBigInput(true);

    if (logic.isPersonalNotebookChannel(draftInputContext.channel.id)) {
      db.wayfindingProgress.setValue((prev) => ({
        ...prev,
        tappedAddNote: true,
      }));
    }
  }, [draftInputContext.channel.id]);

  useRegisterChannelHeaderItem(
    useMemo<ScreenHeaderAction[] | null>(
      () =>
        showBigInput
          ? null
          : [
              {
                id: 'notebook-new',
                text: 'New',
                onPress: handleAdd,
                testID: 'AddNotebookPost',
              },
            ],
      [handleAdd, showBigInput]
    )
  );
  useRegisterChannelHeaderItem(
    useMemo(
      () =>
        showBigInput ? null : (
          <WayfindingNotices.NotebookInputTooltip
            channelId={draftInputContext.channel.id}
          />
        ),
      [draftInputContext.channel.id, showBigInput]
    )
  );

  useImperativeHandle(draftInputRef, () => ({
    exitFullscreen: () => {
      setShowBigInput(false);
    },

    startDraft: () => {
      setShowBigInput(true);
    },
  }));

  return (
    <SafeAreaView
      style={showBigInput ? { flex: 1 } : undefined}
      edges={
        // We don't want to add padding insets when showing the FAB, since that
        // would add blank space below the scroll.
        // (We set layout `bottom` on the FAB below instead.)
        showBigInput ? ['right', 'left', 'bottom'] : []
      }
    >
      <DraftInputConnectedBigInput
        draftInputContext={draftInputContext}
        setShowBigInput={setShowBigInput}
        hidden={!showBigInput}
        overrideChannelType="notebook"
      />
    </SafeAreaView>
  );
}
