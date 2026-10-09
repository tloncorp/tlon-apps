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

import { useGroupTitle } from '../utils';
import { ForwardToChannelSheet } from './ForwardToChannelSheet';
import { ListItem } from './ListItem';
import {
  useForwardToChannelSheet,
  useLastForwarded,
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
  const {
    handleChannelSelected,
    renderFooter,
    onNativeDismissed,
    keepMounted,
    presentationKey,
  } = useForwardToChannelSheet({
    isOpen,
    onClose: () => handleOpenChange(false),
    onForwardToChannel: handleForwardToChannel,
    successMessage: (channelTitle) => `Forwarded group to ${channelTitle}`,
    failureMessage: 'Failed to forward group',
  });

  const shownGroup = useLastForwarded(group);
  const groupTitle = useGroupTitle(shownGroup);
  const contextValue = useMemo(() => ({ open: handleOpen }), [handleOpen]);
  return (
    <ForwardGroupSheetContext.Provider value={contextValue}>
      {children}
      <ForwardToChannelSheet
        key={presentationKey}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onNativeDismissed={onNativeDismissed}
        keepMounted={keepMounted}
        title="Forward group"
        subtitle={groupTitle ?? undefined}
        icon={
          shownGroup ? <ListItem.GroupIcon model={shownGroup} /> : undefined
        }
        onChannelSelected={handleChannelSelected}
        footerComponent={renderFooter}
      />
    </ForwardGroupSheetContext.Provider>
  );
};

export function useForwardGroupSheet() {
  return useContext(ForwardGroupSheetContext);
}
