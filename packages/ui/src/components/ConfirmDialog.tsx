import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Dialog, XStack, YStack } from 'tamagui';

import { Button } from './ButtonV2';
import { Text } from './TextV2';

interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  open = false,
  onOpenChange,
}: ConfirmDialogProps) {
  // Mobile: use native Alert.alert
  useEffect(() => {
    if (!open || Platform.OS === 'web') return;

    Alert.alert(title, description, [
      {
        text: cancelText,
        style: 'cancel',
        onPress: () => onOpenChange?.(false),
      },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => {
          onOpenChange?.(false);
          onConfirm();
        },
      },
    ]);
    // Only run when open changes - not when callbacks are recreated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, description, confirmText, cancelText, destructive]);

  // Web: use Tamagui Dialog
  if (Platform.OS === 'web') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            backgroundColor="$darkOverlay"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            bordered
            elevate
            key="content"
            borderColor="$border"
            borderRadius="$l"
            padding="$l"
            gap="$l"
            width={400}
            maxWidth="90%"
            backgroundColor="$background"
          >
            <YStack gap="$m">
              <Dialog.Title asChild>
                <Text size="$label/l">{title}</Text>
              </Dialog.Title>
              <Dialog.Description asChild>
                <Text size="$body">{description}</Text>
              </Dialog.Description>
            </YStack>
            <XStack gap="$m" justifyContent="flex-end">
              <Dialog.Close asChild>
                <Button fill="text" type="primary" label={cancelText} />
              </Dialog.Close>
              <Button
                fill="text"
                type={destructive ? 'negative' : 'primary'}
                onPress={() => {
                  onConfirm();
                  onOpenChange?.(false);
                }}
                label={confirmText}
              />
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    );
  }

  return null;
}
