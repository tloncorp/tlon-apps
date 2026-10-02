import * as db from '@tloncorp/shared/db';
import { ComponentProps, useMemo } from 'react';

import { channelHasPosts } from '../utils/channelUtils';
import { ActionSheet } from './ActionSheet';
import { ForwardChannelSelector } from './ForwardChannelSelector';
import { FORWARD_SHEET_SNAP_POINTS } from './useForwardToChannelSheet';

type ForwardToChannelSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNativeDismissed: () => void;
  keepMounted: boolean;
  title: string;
  subtitle?: string;
  onChannelSelected: (channel: db.Channel) => void;
  // Narrows the targets further. Postless channels are already excluded for
  // every caller -- see below -- so this is only for rules specific to what is
  // being forwarded.
  channelFilter?: (channel: db.Channel) => boolean;
  footerComponent?: ComponentProps<typeof ActionSheet>['footerComponent'];
};

export function ForwardToChannelSheet({
  open,
  onOpenChange,
  onNativeDismissed,
  keepMounted,
  title,
  subtitle,
  onChannelSelected,
  channelFilter,
  footerComponent,
}: ForwardToChannelSheetProps) {
  // Every target here receives what it is given as a post, so a channel that
  // renders no posts can never be one. Left to the callers this was missed
  // twice over: both Forward sheets passed no filter at all, and the share
  // intent excluded only notebooks.
  const targetFilter = useMemo(
    () => (channel: db.Channel) =>
      channelHasPosts(channel) && (channelFilter?.(channel) ?? true),
    [channelFilter]
  );

  if (!open && !keepMounted) {
    return null;
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      onNativeDismissed={onNativeDismissed}
      snapPointsMode="percent"
      snapPoints={FORWARD_SHEET_SNAP_POINTS}
      enableContentPanningGesture={false}
      footerComponent={footerComponent}
      modal
    >
      <ActionSheet.Content flex={1} paddingBottom="$s">
        <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
        <ForwardChannelSelector
          onChannelSelected={onChannelSelected}
          channelFilter={targetFilter}
        />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
