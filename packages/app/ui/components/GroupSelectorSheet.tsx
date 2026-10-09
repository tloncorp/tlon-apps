import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { YStack, getTokenValue } from 'tamagui';

import { AppDataContextProvider } from '../contexts/appDataContext';
import { AlphaSegmentedGroups } from '../hooks/groupsSorters';
import { useSheetBottomInset } from '../hooks/useSheetBottomInset';
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
  title: string;
  subtitle?: string;
}
export function GroupSelectorSheet(props: SheetProps) {
  const [contentScrolling, setContentScrolling] = useState(false);

  const contactsQuery = store.useContacts();
  const calmSettingsQuery = store.useCalmSettings();

  useEffect(() => {
    if (props.open) {
      triggerHaptic('sheetOpen');
    }
  }, [props.open]);

  const sheetBottomInset = useSheetBottomInset();
  const { onClose } = props;
  const renderFooter = useCallback(
    () => (
      <YStack
        paddingHorizontal="$xl"
        paddingTop="$m"
        paddingBottom={sheetBottomInset + getTokenValue('$xl', 'size')}
      >
        <Button
          preset="primary"
          label="Save"
          centered
          onPress={onClose}
          testID="CloseFavoriteGroupSelectorSheet"
        />
      </YStack>
    ),
    [onClose, sheetBottomInset]
  );

  return (
    <ActionSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      snapPoints={[85]}
      snapPointsMode="percent"
      disableDrag={contentScrolling}
      dismissOnSnapToBottom
      footerComponent={renderFooter}
      modal
    >
      <AppDataContextProvider
        contacts={contactsQuery.data}
        calmSettings={calmSettingsQuery.data}
      >
        <ActionSheet.SimpleHeader
          title={props.title}
          subtitle={props.subtitle}
        />
        <ActionSheet.ScrollableContent id="GroupSelectorScrollableContent">
          {/* Native BottomSheetScrollView ignores padding props, so the gutter
              lives on the content block. */}
          <ActionSheet.ContentBlock flex={1} height="100%">
            <GroupSelector
              selected={props.selected}
              onSelect={props.onSelect}
              onScrollChange={setContentScrolling}
              alphaSegmentedGroups={props.alphaSegmentedGroups}
            />
          </ActionSheet.ContentBlock>
        </ActionSheet.ScrollableContent>
      </AppDataContextProvider>
    </ActionSheet>
  );
}
