import { Button, type IconType } from '@tloncorp/ui';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';

export function NotesDialog({
  children,
  confirmIcon,
  confirmLabel,
  confirmDisabled = false,
  confirming = false,
  onConfirm,
  onOpenChange,
  open,
  subtitle,
  testID,
  title,
  unmountOnClose = false,
}: {
  children: ReactNode;
  confirmIcon?: IconType;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirming?: boolean;
  onConfirm: () => void;
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
      moveOnKeyboardChange
      snapPointsMode="fit"
      unmountOnClose={unmountOnClose}
      dialogContentProps={{ width: 420, maxWidth: '90%' }}
    >
      <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
      {isWeb ? (
        <ActionSheet.ScrollableContent>
          <YStack testID={testID} gap="$l" padding="$l">
            {children}
            <XStack gap="$m" justifyContent="flex-end">
              <Button
                preset="minimal"
                label="Cancel"
                disabled={confirming}
                onPress={() => onOpenChange(false)}
              />
              <Button
                size="small"
                fill="solid"
                type="primary"
                leadingIcon={confirmIcon}
                label={confirmLabel}
                loading={confirming}
                disabled={confirmDisabled}
                onPress={onConfirm}
              />
            </XStack>
          </YStack>
        </ActionSheet.ScrollableContent>
      ) : (
        // Same shape as the other single-field notes sheets: the native sheet
        // has its own close control, so there is no Cancel button.
        <ActionSheet.Content testID={testID}>
          <ActionSheet.FormBlock>{children}</ActionSheet.FormBlock>
          <ActionSheet.FormBlock>
            <Button
              preset="primary"
              label={confirmLabel}
              centered
              loading={confirming}
              disabled={confirmDisabled}
              onPress={onConfirm}
            />
          </ActionSheet.FormBlock>
        </ActionSheet.Content>
      )}
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
