import { forwardGroup } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { ActionSheet } from './ActionSheet';
import { ForwardChannelSelector } from './ForwardChannelSelector';
import {
  FORWARD_SHEET_SNAP_POINTS,
  useForwardToChannelSheet,
} from './useForwardToChannelSheet';

const ForwardGroupSheetContext = createContext<{
  open: (group: db.Group) => void;
}>({ open: () => {} });

export const ForwardGroupSheetProvider = ({ children }: PropsWithChildren) => {
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState<db.Group | null>(null);

  const handleOpen = useCallback((group: db.Group) => {
    setIsOpen(true);
    setGroup(group);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setGroup(null);
    }
  }, []);

  const handleForwardToChannel = useCallback(
    async (channel: db.Channel) => {
      if (!group) {
        throw new Error('Missing group');
      }
      await forwardGroup({
        groupId: group.id,
        channelId: channel.id,
      });
    },
    [group]
  );
  const { handleChannelSelected, renderFooter } = useForwardToChannelSheet({
    isOpen,
    onClose: () => handleOpenChange(false),
    onForwardToChannel: handleForwardToChannel,
    successMessage: (channelTitle) => `Forwarded group to ${channelTitle}`,
    failureMessage: 'Failed to forward group',
  });

  const contextValue = useMemo(() => ({ open: handleOpen }), [handleOpen]);
  return (
    <ForwardGroupSheetContext.Provider value={contextValue}>
      {children}
      <ActionSheet
        open={isOpen}
        onOpenChange={handleOpenChange}
        snapPointsMode="percent"
        snapPoints={FORWARD_SHEET_SNAP_POINTS}
        footerComponent={renderFooter}
      >
        <ActionSheet.Content flex={1} paddingBottom="$s">
          <ActionSheet.SimpleHeader title={'Forward group'} />
          <ForwardChannelSelector
            isOpen={isOpen}
            onChannelSelected={handleChannelSelected}
          />
        </ActionSheet.Content>
      </ActionSheet>
    </ForwardGroupSheetContext.Provider>
  );
};

export function useForwardGroupSheet() {
  return useContext(ForwardGroupSheetContext);
}
