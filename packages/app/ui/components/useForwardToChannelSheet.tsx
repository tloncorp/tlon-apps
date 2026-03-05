import * as db from '@tloncorp/shared/db';
import { Button, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack, getTokenValue } from 'tamagui';

import { useChatTitle } from '../utils';

type UseForwardToChannelSheetParams = {
  isOpen: boolean;
  onClose: () => void;
  onForwardToChannel: (channel: db.Channel) => Promise<void>;
  successMessage: (channelTitle: string) => string;
  failureMessage: string;
};

export const FORWARD_SHEET_SNAP_POINTS: number[] = [85];

export function useForwardToChannelSheet({
  isOpen,
  onClose,
  onForwardToChannel,
  successMessage,
  failureMessage,
}: UseForwardToChannelSheetParams) {
  const [selectedChannel, setSelectedChannel] = useState<db.Channel | null>(
    null
  );
  const selectedChannelTitle = useChatTitle(selectedChannel) ?? 'channel';
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const showToast = useToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isOpen) {
      setSelectedChannel(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setSelectedChannel(channel);
  }, []);

  const handleSendItem = useCallback(async () => {
    if (!selectedChannel) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    try {
      await onForwardToChannel(selectedChannel);
      onClose();
      showToast({
        message: successMessage(selectedChannelTitle),
        duration: 1500,
      });
    } catch {
      setErrorMessage(failureMessage);
      setTimeout(() => setErrorMessage(null), 1500);
    } finally {
      setIsSending(false);
    }
  }, [
    failureMessage,
    onClose,
    onForwardToChannel,
    selectedChannel,
    selectedChannelTitle,
    showToast,
    successMessage,
  ]);

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
          label={
            isSending
              ? 'Forwarding...'
              : errorMessage
                ? errorMessage
                : `Forward to ${selectedChannelTitle}`
          }
          centered
        />
      </YStack>
    );
  }, [
    errorMessage,
    handleSendItem,
    insets.bottom,
    isSending,
    selectedChannel,
    selectedChannelTitle,
  ]);

  return {
    handleChannelSelected,
    renderFooter,
  };
}
