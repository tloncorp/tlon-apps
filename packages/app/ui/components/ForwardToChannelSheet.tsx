import * as db from '@tloncorp/shared/db';
import { ComponentProps } from 'react';

import { ActionSheet } from './ActionSheet';
import { ForwardChannelSelector } from './ForwardChannelSelector';
import {
  FORWARD_SHEET_SNAP_POINTS,
  useDelayedClose,
} from './useForwardToChannelSheet';

type ForwardToChannelSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  onChannelSelected: (channel: db.Channel) => void;
  // Temporary escape hatch for share-target filtering. Should probably push it
  // down into the underlying query.
  channelFilter?: (channel: db.Channel) => boolean;
  footerComponent?: ComponentProps<typeof ActionSheet>['footerComponent'];
};

export function ForwardToChannelSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  onChannelSelected,
  channelFilter,
  footerComponent,
}: ForwardToChannelSheetProps) {
  const showSelector = useDelayedClose(open);

  // Unmount after the close window; otherwise the empty sheet shell can
  // visually resurface during later navigation.
  if (!open && !showSelector) {
    return null;
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={FORWARD_SHEET_SNAP_POINTS}
      keyboardBehavior="extend"
      enableContentPanningGesture={false}
      hasScrollableContent
      footerComponent={footerComponent}
    >
      <ActionSheet.Content flex={1} paddingBottom="$s">
        <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
        {showSelector ? (
          <ForwardChannelSelector
            isOpen={showSelector}
            onChannelSelected={onChannelSelected}
            channelFilter={channelFilter}
          />
        ) : null}
      </ActionSheet.Content>
    </ActionSheet>
  );
}
