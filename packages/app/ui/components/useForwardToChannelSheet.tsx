import * as db from '@tloncorp/shared/db';
import { Button, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack, getTokenValue } from 'tamagui';

import { useSheetCloseAfterAnimation } from '../hooks/useSheetCloseAfterAnimation';
import { useChatTitle } from '../utils';

type UseForwardToChannelSheetParams = {
  isOpen: boolean;
  onClose: () => void;
  onForwardToChannel: (channel: db.Channel) => Promise<void>;
  successMessage: (channelTitle: string) => string | null;
  failureMessage: string;
  closeBeforeForward?: boolean;
  submitLabel?: (channelTitle: string) => string;
  submittingLabel?: string;
};

export const FORWARD_SHEET_SNAP_POINTS: number[] = [85];
export const FORWARD_SHEET_CLOSE_DURATION_MS = 250;

export function useDelayedClose(isOpen: boolean) {
  const [isDelayedCloseOpen, setIsDelayedCloseOpen] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsDelayedCloseOpen(true);
      return;
    }

    const timeout = setTimeout(
      () => setIsDelayedCloseOpen(false),
      FORWARD_SHEET_CLOSE_DURATION_MS
    );

    return () => clearTimeout(timeout);
  }, [isOpen]);

  return isDelayedCloseOpen;
}

export function useForwardToChannelSheet({
  isOpen,
  onClose,
  onForwardToChannel,
  successMessage,
  failureMessage,
  closeBeforeForward = false,
  submitLabel = (channelTitle) => `Forward to ${channelTitle}`,
  submittingLabel = 'Forwarding...',
}: UseForwardToChannelSheetParams) {
  const isDelayedCloseOpen = useDelayedClose(isOpen);
  const [selectedChannel, setSelectedChannel] = useState<db.Channel | null>(
    null
  );
  const selectedChannelTitle = useChatTitle(selectedChannel) ?? 'channel';
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const showToast = useToast();
  const insets = useSafeAreaInsets();
  const { closeAfterAnimation } = useSheetCloseAfterAnimation();

  useEffect(() => {
    if (isDelayedCloseOpen) {
      return;
    }

    setSelectedChannel(null);
    setErrorMessage(null);
  }, [isDelayedCloseOpen]);

  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setSelectedChannel(channel);
  }, []);

  const handleSendItem = useCallback(() => {
    if (!selectedChannel) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    const forward = async () => {
      try {
        await onForwardToChannel(selectedChannel);
        if (!closeBeforeForward) {
          onClose();
        }
        const successText = successMessage(selectedChannelTitle);
        if (successText) {
          showToast({
            message: successText,
            duration: 1500,
          });
        }
      } catch {
        setErrorMessage(failureMessage);
        setTimeout(() => setErrorMessage(null), 1500);
      } finally {
        setIsSending(false);
      }
    };

    if (closeBeforeForward) {
      onClose();
      closeAfterAnimation(() => void forward());
    } else {
      void forward();
    }
  }, [
    closeAfterAnimation,
    closeBeforeForward,
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
              ? submittingLabel
              : errorMessage
                ? errorMessage
                : submitLabel(selectedChannelTitle)
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
    submitLabel,
    submittingLabel,
  ]);

  return {
    handleChannelSelected,
    renderFooter,
  };
}
