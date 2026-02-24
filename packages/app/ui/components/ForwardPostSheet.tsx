import { forwardPost } from '@tloncorp/shared';
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

const ForwardPostSheetContext = createContext<{
  open: (post: db.Post) => void;
}>({ open: () => {} });

export const ForwardPostSheetProvider = ({ children }: PropsWithChildren) => {
  const [isOpen, setIsOpen] = useState(false);
  const [post, setPost] = useState<db.Post | null>(null);

  const handleOpen = useCallback((post: db.Post) => {
    setIsOpen(true);
    setPost(post);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setPost(null);
    }
  }, []);

  const handleForwardToChannel = useCallback(
    async (channel: db.Channel) => {
      if (!post) {
        throw new Error('Missing post');
      }
      await forwardPost({ postId: post.id, channelId: channel.id });
    },
    [post]
  );
  const { handleChannelSelected, renderFooter } = useForwardToChannelSheet({
    isOpen,
    onClose: () => handleOpenChange(false),
    onForwardToChannel: handleForwardToChannel,
    successMessage: (channelTitle) => `Forwarded post to ${channelTitle}`,
    failureMessage: 'Failed to forward post',
  });

  const contextValue = useMemo(() => ({ open: handleOpen }), [handleOpen]);
  return (
    <ForwardPostSheetContext.Provider value={contextValue}>
      {children}
      <ActionSheet
        open={isOpen}
        onOpenChange={handleOpenChange}
        snapPointsMode="percent"
        snapPoints={FORWARD_SHEET_SNAP_POINTS}
        footerComponent={renderFooter}
      >
        <ActionSheet.Content flex={1} paddingBottom="$s">
          <ActionSheet.SimpleHeader title={'Forward to channel'} />
          <ForwardChannelSelector
            isOpen={isOpen}
            onChannelSelected={handleChannelSelected}
          />
        </ActionSheet.Content>
      </ActionSheet>
    </ForwardPostSheetContext.Provider>
  );
};

export const useForwardPostSheet = () => {
  const context = useContext(ForwardPostSheetContext);
  if (!context) {
    throw new Error(
      'useForwardPostSheet must be used within a ForwardPostSheetProvider'
    );
  }
  return context;
};
