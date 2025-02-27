import * as db from '@tloncorp/shared/db';
import { Sheet, SheetHeader, Text } from '@tloncorp/ui';
import React, { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { YStack } from 'tamagui';

import { AlphaSegmentedGroups } from '../hooks/groupsSorters';
import { triggerHaptic } from '../utils';
import { GroupSelector } from './GroupSelector';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelected?: string[];
  selected?: string[];
  onSelect?: (group: db.Group) => void;
  onClose: () => void;
  alphaSegmentedGroups: AlphaSegmentedGroups;
  TopContent?: React.ReactNode;
}
export function GroupSelectorSheet(props: SheetProps) {
  const [contentScrolling, setContentScrolling] = useState(false);

  useEffect(() => {
    if (props.open) {
      triggerHaptic('sheetOpen');
    }
  }, [props.open]);

  return (
    <Modal
      visible={props.open}
      animationType="none"
      transparent
      onRequestClose={() => props.onOpenChange(false)}
    >
      <Sheet
        open={props.open}
        onOpenChange={props.onOpenChange}
        snapPoints={[85]}
        disableDrag={contentScrolling}
        dismissOnSnapToBottom
        animation="quick"
      >
        <Sheet.Overlay />
        <Sheet.LazyFrame paddingTop="$s" paddingHorizontal="$2xl">
          <Sheet.Handle marginBottom="$l" />
          <SheetHeader marginBottom="$2xl">
            <SheetHeader.Title>{props.TopContent}</SheetHeader.Title>
            <SheetHeader.RightControls>
              <SheetHeader.ButtonText
                onPress={props.onClose}
                testID="CloseFavoriteGroupSelectorSheet"
              >
                Close
              </SheetHeader.ButtonText>
            </SheetHeader.RightControls>
          </SheetHeader>

          <GroupSelector
            selected={props.selected}
            onSelect={props.onSelect}
            onScrollChange={setContentScrolling}
            alphaSegmentedGroups={props.alphaSegmentedGroups}
          />
        </Sheet.LazyFrame>
      </Sheet>
    </Modal>
  );
}
