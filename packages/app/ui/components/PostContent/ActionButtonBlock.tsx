import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';
import { Button, useToast } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { XStack } from 'tamagui';

import {
  actionButtonErrorMessage,
  fireActionButtonPoke,
} from './actionButtonPoke';

export function ActionButtonBlock({
  actionButton,
}: {
  actionButton: PostBlobDataEntryActionButton;
}) {
  const showToast = useToast();
  const [hasPressed, setHasPressed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePress = useCallback(async () => {
    try {
      setIsSubmitting(true);
      await fireActionButtonPoke(actionButton);
      setHasPressed(true);
    } catch (error) {
      showToast({
        message: actionButtonErrorMessage(error),
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [actionButton, showToast]);

  return (
    <Button
      alignSelf="flex-start"
      disabled={isSubmitting}
      label={actionButton.label}
      loading={isSubmitting}
      onPress={handlePress}
      opacity={hasPressed && !isSubmitting ? 0.72 : 1}
      preset="secondary"
      trailingIcon={hasPressed && !isSubmitting ? 'Checkmark' : undefined}
    />
  );
}

export function ActionButtonRow({
  actionButtons,
}: {
  actionButtons: PostBlobDataEntryActionButton[];
}) {
  return (
    <XStack
      alignItems="flex-start"
      flexWrap="wrap"
      gap="$s"
      padding="$l"
      width="100%"
    >
      {actionButtons.map((actionButton, index) => (
        <ActionButtonBlock
          key={`${actionButton.label}-${index}`}
          actionButton={actionButton}
        />
      ))}
    </XStack>
  );
}
