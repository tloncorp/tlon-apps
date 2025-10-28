import { ActionSheet, createActionGroup } from './ActionSheet';

export function ConfirmationSheet({
  title,
  subtitle,
  warningMessage,
  confirmButtonTitle,
  confirmButtonType = 'negative',
  open,
  onOpenChange,
  confirmAction,
}: {
  title: string;
  subtitle?: string;
  warningMessage?: string;
  confirmButtonTitle: string;
  confirmButtonType?: 'negative' | 'neutral' | 'positive';
  open: boolean;
  onOpenChange: (show: boolean) => void;
  confirmAction: () => void;
}) {
  const buildSubtitle = () => {
    if (!warningMessage) return subtitle;
    if (!subtitle) return warningMessage;
    return `${subtitle}\n\n${warningMessage}`;
  };

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader
        title={title}
        subtitle={buildSubtitle()}
      />
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList
          actionGroups={[
            createActionGroup(confirmButtonType, {
              title: confirmButtonTitle,
              action: confirmAction,
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