import { Button } from '@tloncorp/ui';
import { useCallback, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Platform } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';

export function NotesDialog({
  cancelDisabled = false,
  children,
  confirmButton,
  keyboardBehavior,
  onOpenChange,
  open,
  subtitle,
  testID,
  title,
  unmountOnClose = false,
}: {
  cancelDisabled?: boolean;
  children: ReactNode;
  confirmButton?: ReactNode;
  keyboardBehavior?: ComponentProps<typeof ActionSheet>['keyboardBehavior'];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  subtitle?: string;
  testID?: string;
  title: string;
  unmountOnClose?: boolean;
}) {
  const isWeb = Platform.OS === 'web';
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode={isWeb ? 'dialog' : 'sheet'}
      closeButton={isWeb}
      modal
      snapPointsMode="fit"
      keyboardBehavior={keyboardBehavior}
      unmountOnClose={unmountOnClose}
      dialogContentProps={{ width: 420, maxWidth: '90%' }}
    >
      <ActionSheet.ScrollableContent>
        <YStack testID={testID} gap="$l" padding="$l">
          <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
          {children}
          <XStack gap="$m" justifyContent="flex-end">
            <Button
              preset="minimal"
              label="Cancel"
              disabled={cancelDisabled}
              onPress={() => onOpenChange(false)}
            />
            {confirmButton}
          </XStack>
        </YStack>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

export function useEntityDialog<T>() {
  const [entity, setEntity] = useState<T | null>(null);
  const [isPending, setIsPending] = useState(false);
  const generationRef = useRef(0);

  const open = useCallback((next: T) => {
    generationRef.current += 1;
    setIsPending(false);
    setEntity(next);
  }, []);
  const close = useCallback(() => {
    generationRef.current += 1;
    setIsPending(false);
    setEntity(null);
  }, []);
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        close();
      }
    },
    [close]
  );
  const run = useCallback(async (action: () => Promise<void>) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setIsPending(true);
    try {
      await action();
      if (generationRef.current === generation) {
        setEntity(null);
      }
    } finally {
      if (generationRef.current === generation) {
        setIsPending(false);
      }
    }
  }, []);

  return { entity, isPending, open, close, handleOpenChange, run };
}
