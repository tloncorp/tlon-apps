import { useState } from 'react';
import { Platform } from 'react-native';

import { useSheetDismissalAction } from '../../hooks/useSheetDismissalAction';
import { createActionGroups } from '../ActionSheet';
import { NotesActionMenu } from '../NotesChannel/NotesActions';
import { OverflowTriggerButton } from '../OverflowMenuButton';

export function BucketPreviewActions({
  onOpen,
  onDelete,
}: {
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { dismissThenRun, onDismissed, presentationKey } =
    useSheetDismissalAction({
      open,
      onOpenChange: setOpen,
      waitForDismissal: Platform.OS !== 'web',
    });

  return (
    <NotesActionMenu
      key={presentationKey}
      groups={createActionGroups([
        'neutral',
        {
          title: 'Open in browser',
          startIcon: 'ExternalLink',
          action: onOpen,
          disabled: !onOpen,
        },
        onDelete && {
          title: 'Delete file',
          startIcon: 'Trash',
          action: onDelete,
          accent: 'negative',
        },
      ])}
      open={open}
      onOpenChange={setOpen}
      onAction={(action) => dismissThenRun(() => action?.())}
      onNativeDismissed={onDismissed}
      trigger={
        <OverflowTriggerButton
          accessibilityLabel="File actions"
          aria-label="File actions"
          testID="BucketPreviewActions"
          onPress={() => setOpen(true)}
        />
      }
    />
  );
}
