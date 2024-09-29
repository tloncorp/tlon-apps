import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'tamagui';

import { FloatingActionButton } from '../FloatingActionButton';
import { Icon } from '../Icon';
import { DraftInputConnectedBigInput } from './DraftInputConnectedBigInput';
import { DraftInputContext } from './shared';

export function NotebookInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const { editingPost, onPresentationModeChange } = draftInputContext;

  const [showBigInput, setShowBigInput] = useState(false);
  const safeAreaInsets = useSafeAreaInsets();

  // Notify host when presenting/dismissing big input
  useEffect(() => {
    onPresentationModeChange?.(showBigInput ? 'fullscreen' : 'inline');
  }, [showBigInput, onPresentationModeChange]);

  // Use big input when editing a post
  const isEditingPost = editingPost != null;
  useEffect(() => {
    setShowBigInput(isEditingPost);
  }, [isEditingPost]);

  return (
    <>
      {showBigInput && (
        <DraftInputConnectedBigInput
          draftInputContext={draftInputContext}
          setShowBigInput={setShowBigInput}
        />
      )}

      {!showBigInput && (
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
    </>
  );
}
