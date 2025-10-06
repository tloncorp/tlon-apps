import * as db from '@tloncorp/shared/db';
import { SheetHeader, View } from '@tloncorp/ui';
import React, { useEffect, useState } from 'react';

import { AlphaSegmentedGroups } from '../hooks/groupsSorters';
import { triggerHaptic } from '../utils';
import { ActionSheet } from './ActionSheet';
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
    <ActionSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      snapPoints={[85]}
      snapPointsMode="percent"
      disableDrag={contentScrolling}
      dismissOnSnapToBottom
    >
      <ActionSheet.Content paddingBottom="$s">
        <SheetHeader paddingHorizontal="$2xl">
          <SheetHeader.Title>{props.TopContent}</SheetHeader.Title>
          <SheetHeader.RightControls>
            <SheetHeader.ButtonText
              onPress={props.onClose}
              testID="CloseFavoriteGroupSelectorSheet"
            >
              Save
            </SheetHeader.ButtonText>
          </SheetHeader.RightControls>
        </SheetHeader>
      </ActionSheet.Content>
      <ActionSheet.ScrollableContent
        id="GroupSelectorScrollableContent"
        padding="$xl"
      >
        <View flex={1} height="100%">
          <GroupSelector
            selected={props.selected}
            onSelect={props.onSelect}
            onScrollChange={setContentScrolling}
            alphaSegmentedGroups={props.alphaSegmentedGroups}
          />
        </View>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
