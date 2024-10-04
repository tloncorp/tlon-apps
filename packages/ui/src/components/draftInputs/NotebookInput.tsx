import { useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { View } from 'tamagui';

import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import { FloatingActionButton } from '../FloatingActionButton';
import { Icon } from '../Icon';
import { ParentAgnosticKeyboardAvoidingView } from '../ParentAgnosticKeyboardAvoidingView';
import { ScreenHeader } from '../ScreenHeader';
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

  useRegisterChannelHeaderItem(
    useMemo(
      () =>
        showBigInput ? null : (
          <ScreenHeader.IconButton
            type="Add"
            onPress={() => setShowBigInput(true)}
          />
        ),
      [showBigInput]
    )
  );

  useImperativeHandle(draftInputRef, () => ({
    exitFullscreen: () => {
      setShowBigInput(false);
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
              icon={<Icon type="Add" size={'$s'} marginRight={'$s'} />}
            />
          </View>
        )}
      </ParentAgnosticKeyboardAvoidingView>
    </SafeAreaView>
  );
}
