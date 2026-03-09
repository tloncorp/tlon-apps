import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';
import { Button } from '@tloncorp/ui';
import { XStack } from 'tamagui';

export function ActionButtonBlock({
  actionButton,
}: {
  actionButton: PostBlobDataEntryActionButton;
}) {
  return (
    <Button
      alignSelf="flex-start"
      label={actionButton.label}
      preset="secondary"
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
