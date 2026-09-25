import { isThirdPartyChannel } from '@tloncorp/api/urbit';
import { CursorNormalizationError } from '@tloncorp/shared/store';
import { useToast } from '@tloncorp/ui';
import { useEffect, useRef } from 'react';

export function useRecoverCursorJump({
  channelId,
  selectedPostId,
  clearedCursor,
  isFocused,
  isLoading,
  isFetching,
  error,
  onRecover,
}: {
  channelId: string;
  selectedPostId?: string | null;
  clearedCursor: boolean;
  isFocused: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  onRecover: () => void;
}) {
  const toast = useToast();
  const recoveredError = useRef<Error | null>(null);

  useEffect(() => {
    // Third-party channels resolve their own targets (e.g. Notes waits for
    // the selected note to sync). A post-cursor failure must not clear them.
    if (isThirdPartyChannel(channelId)) {
      return;
    }
    if (
      !isFocused ||
      isLoading ||
      isFetching ||
      clearedCursor ||
      !selectedPostId ||
      !(error instanceof CursorNormalizationError) ||
      error.channelId !== channelId ||
      error.diagnostics.cursorPostId !== selectedPostId ||
      recoveredError.current === error
    ) {
      return;
    }
    recoveredError.current = error;
    toast({ message: "Couldn't jump to this message", duration: 2500 });
    onRecover();
  }, [
    channelId,
    selectedPostId,
    clearedCursor,
    isFocused,
    isLoading,
    isFetching,
    error,
    onRecover,
    toast,
  ]);
}
