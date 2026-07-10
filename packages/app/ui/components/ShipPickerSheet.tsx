import { useIsWindowNarrow } from '@tloncorp/ui';
import { useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { View, YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { ContactBook } from './ContactBook';

// A ship picker sheet mirroring the DM contact picker: a searchable ContactBook
// that also accepts any typed @p (ContactBook synthesizes a fallback contact
// for a valid patp). Bottom sheet on narrow, dialog on wide, like CreateChat.
export function ShipPickerSheet({
  open,
  onOpenChange,
  title = 'Add a user',
  subtitle,
  disabledIds,
  disabledReason = 'Already on this list',
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle: string;
  disabledIds: string[];
  disabledReason?: string;
  onSelect: (shipId: string) => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const [scrolling, setScrolling] = useState(false);
  // Let the drag handle (not the list) own the pan gesture on Android so the
  // nested ContactBook can scroll.
  const enableContentPanningGesture = useMemo(
    () => (Platform.OS === 'android' ? false : undefined),
    []
  );

  const body = (
    <YStack flex={1} gap="$l" $sm={{ paddingHorizontal: '$xl' }}>
      <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
      <ContactBook
        searchable
        autoFocus={!isWindowNarrow}
        searchPlaceholder="Filter by nickname or @p"
        onSelect={onSelect}
        onScrollChange={setScrolling}
        disabledIds={disabledIds}
        disabledReason={disabledReason}
        maxHeight={isWindowNarrow ? undefined : 500}
      />
    </YStack>
  );

  if (isWindowNarrow) {
    return (
      <ActionSheet
        open={open}
        onOpenChange={onOpenChange}
        moveOnKeyboardChange
        snapPoints={[90]}
        snapPointsMode="percent"
        disableDrag={scrolling}
        enableContentPanningGesture={enableContentPanningGesture}
        hasScrollableContent
      >
        {body}
      </ActionSheet>
    );
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode="dialog"
      closeButton
      dialogContentProps={{ height: 'auto', maxHeight: 1200, width: 600 }}
    >
      <View flex={1} padding="$m">
        {body}
      </View>
    </ActionSheet>
  );
}
