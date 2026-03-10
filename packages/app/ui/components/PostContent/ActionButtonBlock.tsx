import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';
import { Button, useToast } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { YStack } from 'tamagui';

import {
  PokeTemplateContext,
  actionButtonErrorMessage,
  fireActionButtonPoke,
  sendActionResponse,
} from './actionButtonPoke';

export function ActionButtonBlock({
  actionButton,
  templateContext,
}: {
  actionButton: PostBlobDataEntryActionButton;
  templateContext?: PokeTemplateContext;
}) {
  const showToast = useToast();
  const [hasPressed, setHasPressed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePress = useCallback(async () => {
    try {
      setIsSubmitting(true);
      if (actionButton.action.type === 'poke') {
        await fireActionButtonPoke(actionButton, templateContext);
      } else if (actionButton.action.type === 'response') {
        await sendActionResponse(actionButton, templateContext ?? {});
      }
      setHasPressed(true);
    } catch (error) {
      showToast({
        message: actionButtonErrorMessage(error),
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [actionButton, templateContext, showToast]);

  return (
    <Button
      disabled={isSubmitting}
      label={actionButton.label}
      loading={isSubmitting}
      onPress={handlePress}
      opacity={hasPressed && !isSubmitting ? 0.72 : 1}
      preset="secondaryOutline"
      size="small"
      trailingIcon={hasPressed && !isSubmitting ? 'Checkmark' : undefined}
    />
  );
}

export function ActionButtonRow({
  actionButtons,
  templateContext,
}: {
  actionButtons: PostBlobDataEntryActionButton[];
  templateContext?: PokeTemplateContext;
}) {
  return (
    <YStack gap="$s" paddingVertical="$l" width="100%">
      {actionButtons.map((actionButton, index) => (
        <ActionButtonBlock
          key={`${actionButton.label}-${index}`}
          actionButton={actionButton}
          templateContext={templateContext}
        />
      ))}
    </YStack>
  );
}
