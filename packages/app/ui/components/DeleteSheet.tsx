import { ActionSheet, createActionGroup } from './ActionSheet';

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
      <ActionSheet.SimpleHeader
        title={`Delete ${title}?`}
        subtitle="This action cannot be undone."
      />
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList
          actionGroups={[
            createActionGroup('negative', {
              title: `Delete ${itemTypeDescription}`,
              action: deleteAction,
            }),
            createActionGroup('neutral', {
              title: 'Cancel',
              action: () => onOpenChange(false),
            }),
          ]}
        />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
