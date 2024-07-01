import { Text } from '../core';
import { ActionSheet } from './ActionSheet';

export function DeleteSheet({
  title,
  itemTypeDescription,
  open,
  onOpenChange,
  deleteAction,
}: {
  title: string;
  itemTypeDescription: string;
  open: boolean;
  onOpenChange: (show: boolean) => void;
  deleteAction: () => void;
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.Title>Delete {title}</ActionSheet.Title>
      <ActionSheet.Description>
        <Text>
          Are you sure you want to delete {title}? This action cannot be undone.
        </Text>
      </ActionSheet.Description>
      <ActionSheet.Action destructive action={deleteAction}>
        <ActionSheet.ActionTitle>
          Delete {itemTypeDescription}
        </ActionSheet.ActionTitle>
      </ActionSheet.Action>
      <ActionSheet.Action action={() => onOpenChange(false)}>
        <ActionSheet.ActionTitle>Cancel</ActionSheet.ActionTitle>
      </ActionSheet.Action>
    </ActionSheet>
  );
}
