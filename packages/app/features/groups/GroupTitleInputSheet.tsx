import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack, getTokenValue } from 'tamagui';

import { ActionSheet, Button, TextInput, useIsWindowNarrow } from '../../ui';

interface GroupTitleInputSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitTitle: (title: string) => void;
}

export function GroupTitleInputSheet({
  open,
  onOpenChange,
  onSubmitTitle,
}: GroupTitleInputSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();
  const [title, setTitle] = useState('');

  const handleNext = useCallback(() => {
    if (title.trim()) {
      onSubmitTitle(title.trim());
      setTitle('');
    }
  }, [title, onSubmitTitle]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setTitle('');
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  const header = (
    <ActionSheet.SimpleHeader
      title="Name your group"
      subtitle="Choose a name for your group"
    />
  );

  const input = (
    <TextInput
      placeholder="Group name"
      value={title}
      onChangeText={setTitle}
      autoFocus={!isWindowNarrow}
      onSubmitEditing={handleNext}
      returnKeyType="next"
    />
  );

  const nextButton = (
    <Button fill="solid" type="primary" disabled={!title.trim()} onPress={handleNext} label="Next" centered />
  );

  const content = isWindowNarrow ? (
    <YStack flex={1} gap="$l">
      {header}
      <YStack paddingHorizontal="$xl">{input}</YStack>
      <YStack flex={1} />
      <YStack
        padding="$xl"
        paddingBottom={bottom + getTokenValue('$xl', 'size')}
      >
        {nextButton}
      </YStack>
    </YStack>
  ) : (
    <YStack gap="$l">
      {header}
      <YStack gap="$l" paddingHorizontal="$xl">
        {input}
      </YStack>
      <YStack paddingHorizontal="$xl" paddingTop="$l">
        {nextButton}
      </YStack>
    </YStack>
  );

  const actionSheetProps = isWindowNarrow
    ? {
        snapPoints: [50],
        snapPointsMode: 'percent' as const,
      }
    : {
        mode: 'dialog' as const,
        closeButton: true,
        dialogContentProps: { width: 600 },
      };

  return (
    <ActionSheet open={open} onOpenChange={handleOpenChange} {...actionSheetProps}>
      {isWindowNarrow ? content : <View padding="$m">{content}</View>}
    </ActionSheet>
  );
}
