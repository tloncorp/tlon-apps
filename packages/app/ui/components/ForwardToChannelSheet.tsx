import * as db from '@tloncorp/shared/db';
import { ComponentProps } from 'react';

import { ActionSheet } from './ActionSheet';
import { ForwardChannelSelector } from './ForwardChannelSelector';
import { FORWARD_SHEET_SNAP_POINTS } from './useForwardToChannelSheet';

type ForwardToChannelSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onChannelSelected: (channel: db.Channel) => void;
  channelFilter?: (channel: db.Channel) => boolean;
  footerComponent?: ComponentProps<typeof ActionSheet>['footerComponent'];
};

export function ForwardToChannelSheet({
  open,
  onOpenChange,
  title,
  onChannelSelected,
  channelFilter,
  footerComponent,
}: ForwardToChannelSheetProps) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={FORWARD_SHEET_SNAP_POINTS}
      footerComponent={footerComponent}
    >
      <ActionSheet.Content flex={1} paddingBottom="$s">
        <ActionSheet.SimpleHeader title={title} />
        {open ? (
          <ForwardChannelSelector
            isOpen={open}
            onChannelSelected={onChannelSelected}
            channelFilter={channelFilter}
          />
        ) : null}
      </ActionSheet.Content>
    </ActionSheet>
  );
}
