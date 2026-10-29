import { useWindowDimensions, type KeyDownEvent } from 'react-native';
import { Icon, Pressable } from '@tloncorp/ui';
import { useEffect } from 'react';
import { Dialog, VisuallyHidden, XStack, isWeb } from 'tamagui';

import type { BrowserCredentialHandoffParams } from '../../navigation/types';
import { ActionSheet } from '../../ui/components/ActionSheet';
import { BrowserCredentialHandoffContent } from './BrowserCredentialHandoffScreen';

export function BrowserCredentialHandoffSheet({
  open,
  onClose,
  onDismiss,
  ...params
}: BrowserCredentialHandoffParams & {
  open: boolean;
  onClose(): void;
  onDismiss(): void;
}) {
  const { width, height } = useWindowDimensions();
  const title = params.loginApproval
    ? 'Approve sign-in'
    : 'Secure browser form';
  useEffect(() => {
    if (isWeb && !open) onDismiss();
  }, [open, onDismiss]);

  const content = (
    <BrowserCredentialHandoffContent
      {...params}
      open={open}
      onClose={onClose}
    />
  );

  if (isWeb) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next: boolean) => {
          if (!next) onClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay backgroundColor="$darkOverlay" opacity={0.5} />
          <Dialog.Content
            width={width * 0.9}
            maxWidth={560}
            maxHeight={height * 0.85}
            padding={0}
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="$border"
            overflow="hidden"
          >
            <VisuallyHidden>
              <Dialog.Title>{title}</Dialog.Title>
            </VisuallyHidden>
            <XStack
              paddingHorizontal="$l"
              paddingTop="$l"
              alignItems="center"
              justifyContent="flex-end"
            >
              <Pressable
                onPress={onClose}
                role="button"
                tabIndex={0}
                onKeyDown={(event: KeyDownEvent & { key?: string }) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClose();
                  }
                }}
                backgroundColor="transparent"
                borderWidth={0}
                aria-label="Close secure form"
                padding="$m"
              >
                <Icon type="Close" />
              </Pressable>
            </XStack>
            {content}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    );
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
      onNativeDismissed={onDismiss}
      snapPointsMode="fit"
      title={title}
    >
      {content}
    </ActionSheet>
  );
}
