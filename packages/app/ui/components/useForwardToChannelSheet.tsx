import * as db from '@tloncorp/shared/db';
import { Button, useToast, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack, getTokenValue } from 'tamagui';

import { useSheetDismissalAction } from '../hooks/useSheetDismissalAction';
import { useChatTitle } from '../utils';

type UseForwardToChannelSheetParams = {
  isOpen: boolean;
  onClose: () => void;
  onForwardToChannel: (channel: db.Channel) => Promise<void>;
  successMessage: (channelTitle: string) => string | null;
  failureMessage: string;
  closeBeforeForward?: boolean;
};

export const FORWARD_SHEET_SNAP_POINTS: number[] = [85];
export function useForwardToChannelSheet({
  isOpen,
  onClose,
  onForwardToChannel,
  successMessage,
  failureMessage,
  closeBeforeForward = false,
}: UseForwardToChannelSheetParams) {
  const [selectedChannel, setSelectedChannel] = useState<db.Channel | null>(
    null
  );
  const selectedChannelTitle = useChatTitle(selectedChannel) ?? 'channel';
  const [isSending, setIsSending] = useState(false);
  const queuedForward = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const showToast = useToast();
  const insets = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();
  const { dismissThenRun, onDismissed, shouldRender, presentationKey } =
    useSheetDismissalAction({
      open: isOpen,
      onOpenChange: onClose,
      waitForDismissal: Platform.OS !== 'web' && isWindowNarrow,
    });

  useEffect(() => {
    if (shouldRender) {
      return;
    }

    setSelectedChannel(null);
    setErrorMessage(null);
  }, [shouldRender]);

  // Reopening cancels a queued forward, so its finally block will not run.
  useEffect(() => {
    if (queuedForward.current) {
      queuedForward.current = false;
      setIsSending(false);
    }
  }, [presentationKey]);

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
      queuedForward.current = false;
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
      queuedForward.current = true;
      dismissThenRun(() => void forward());
    } else {
      void forward();
    }
  }, [
    dismissThenRun,
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
    onNativeDismissed: onDismissed,
    keepMounted: shouldRender,
    presentationKey,
  };
}
