import { forwardPost } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, useToast } from '@tloncorp/ui';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack, getTokenValue } from 'tamagui';

import { useChatTitle } from '../utils';
import { ActionSheet } from './ActionSheet';
import { ForwardChannelSelector } from './ForwardChannelSelector';

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

  const [selectedChannel, setSelectedChannel] = useState<db.Channel | null>(
    null
  );
  const selectedChannelTitle = useChatTitle(selectedChannel);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setSelectedChannel(channel);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSelectedChannel(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const showToast = useToast();
  const handleSendItem = useCallback(async () => {
    if (post && selectedChannel) {
      setIsSending(true);
      setErrorMessage(null);
      try {
        await forwardPost({ postId: post.id, channelId: selectedChannel.id });
        setIsOpen(false);
        showToast({
          message: `Forwarded post to ${selectedChannelTitle}`,
          duration: 1500,
        });
      } catch (error) {
        setErrorMessage('Failed to forward post');
        setTimeout(() => setErrorMessage(null), 1500);
      } finally {
        setIsSending(false);
      }
    }
  }, [post, selectedChannel, selectedChannelTitle, showToast]);

  const insets = useSafeAreaInsets();

  const renderFooter = useCallback(() => {
    if (!selectedChannel) {
      return null;
    }
    return (
      <YStack
        paddingBottom={insets.bottom + getTokenValue('$xl', 'size')}
        paddingHorizontal="$xl"
      >
        <Button
          preset="primary"
          onPress={handleSendItem}
          disabled={isSending || !!errorMessage}
          label={isSending
            ? 'Forwarding...'
            : errorMessage
              ? errorMessage
              : `Forward to ${selectedChannelTitle}`}
          centered
        />
      </YStack>
    );
  }, [
    handleSendItem,
    insets.bottom,
    isSending,
    errorMessage,
    selectedChannelTitle,
    selectedChannel,
  ]);

  const contextValue = useMemo(() => ({ open: handleOpen }), [handleOpen]);
  return (
    <ForwardPostSheetContext.Provider value={contextValue}>
      {children}
      <ActionSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        snapPointsMode="percent"
        snapPoints={[85]}
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
