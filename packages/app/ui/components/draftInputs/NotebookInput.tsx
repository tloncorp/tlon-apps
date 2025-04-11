import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { FloatingActionButton } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { ParentAgnosticKeyboardAvoidingView } from '@tloncorp/ui';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { View } from 'tamagui';

import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { ScreenHeader } from '../ScreenHeader';
import WayfindingNotices from '../Wayfinding/Notices';
import { DraftInputConnectedBigInput } from './DraftInputConnectedBigInput';
import { DraftInputContext } from './shared';

export function NotebookInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const { draftInputRef, editingPost, onPresentationModeChange, headerMode } =
    draftInputContext;
  const safeAreaInsets = useSafeAreaInsets();
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
    useMemo(
      () =>
        showBigInput ? null : (
          <>
            <ScreenHeader.IconButton
              key="notebook"
              type="Add"
              onPress={handleAdd}
            />
            <WayfindingNotices.NotebookInputTooltip
              channelId={draftInputContext.channel.id}
            />
          </>
        ),
      [draftInputContext.channel.id, handleAdd, showBigInput]
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
      edges={
        // We don't want to add padding insets when showing the FAB, since that
        // would add blank space below the scroll.
        // (We set layout `bottom` on the FAB below instead.)
        showBigInput ? ['right', 'left', 'bottom'] : []
      }
    >
      <ParentAgnosticKeyboardAvoidingView>
        <DraftInputConnectedBigInput
          draftInputContext={draftInputContext}
          setShowBigInput={setShowBigInput}
          hidden={!showBigInput}
          overrideChannelType="notebook"
        />

        {headerMode === 'next' && !showBigInput && (
          <View
            position="absolute"
            bottom={safeAreaInsets.bottom}
            flex={1}
            width="100%"
            alignItems="center"
          >
            <FloatingActionButton
              onPress={() => setShowBigInput(true)}
              icon={<Icon type="Add" size={'$m'} />}
            />
          </View>
        )}
      </ParentAgnosticKeyboardAvoidingView>
    </SafeAreaView>
  );
}
