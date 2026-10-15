import { forwardChannel } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useChannelTitle } from '../utils';
import { ForwardToChannelSheet } from './ForwardToChannelSheet';
import { ListItem } from './ListItem';
import {
  useForwardToChannelSheet,
  useLastForwarded,
} from './useForwardToChannelSheet';

const ForwardChannelSheetContext = createContext<{
  open: (channel: db.Channel) => void;
}>({ open: () => {} });

export const ForwardChannelSheetProvider = ({
  children,
}: PropsWithChildren) => {
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<db.Channel | null>(null);

  const handleOpen = useCallback((channel: db.Channel) => {
    setIsOpen(true);
    setChannel(channel);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setChannel(null);
    }
  }, []);

  const handleForwardToChannel = useCallback(
    async (destination: db.Channel) => {
      if (!channel) {
        throw new Error('Missing channel');
      }
      await forwardChannel({
        sourceChannelId: channel.id,
        channelId: destination.id,
      });
    },
    [channel]
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
    successMessage: (channelTitle) => `Forwarded channel to ${channelTitle}`,
    failureMessage: 'Failed to forward channel',
  });

  const shownChannel = useLastForwarded(channel);
  const channelTitle = useChannelTitle(shownChannel);
  const contextValue = useMemo(() => ({ open: handleOpen }), [handleOpen]);
  return (
    <ForwardChannelSheetContext.Provider value={contextValue}>
      {children}
      <ForwardToChannelSheet
        key={presentationKey}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onNativeDismissed={onNativeDismissed}
        keepMounted={keepMounted}
        title="Forward channel"
        subtitle={channelTitle ?? undefined}
        icon={
          shownChannel ? (
            <ListItem.ChannelIcon model={shownChannel} />
          ) : undefined
        }
        onChannelSelected={handleChannelSelected}
        footerComponent={renderFooter}
      />
    </ForwardChannelSheetContext.Provider>
  );
};

export function useForwardChannelSheet() {
  return useContext(ForwardChannelSheetContext);
}
