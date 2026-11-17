import { useState } from 'react';
import { Platform } from 'react-native';

import { useSheetDismissalAction } from '../../hooks/useSheetDismissalAction';
import { createActionGroups } from '../ActionSheet';
import { IconMenu } from '../IconMenu';
import { NotesActionMenu } from '../NotesChannel/NotesActions';
import {
  OverflowMenuLabel,
  OverflowTriggerButton,
} from '../OverflowMenuButton';
import { actionGroupsToMenuItems } from '../actionMenuItems';

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
  const groups = createActionGroups([
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
  ]);

  // Like every overflow button on a phone, this opens a native menu.
  if (Platform.OS !== 'web') {
    return (
      <IconMenu
        items={actionGroupsToMenuItems(groups)}
        accessibilityLabel="File actions"
        testID="BucketPreviewActions"
      >
        <OverflowMenuLabel />
      </IconMenu>
    );
  }

  return (
    <NotesActionMenu
      key={presentationKey}
      groups={groups}
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
