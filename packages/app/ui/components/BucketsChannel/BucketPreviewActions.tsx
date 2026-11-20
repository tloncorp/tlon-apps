import { useMemo, useState } from 'react';
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

type BucketPreviewActionsProps = {
  onOpen?: () => void;
  onDelete?: () => void;
};

function previewActionGroups({ onOpen, onDelete }: BucketPreviewActionsProps) {
  return createActionGroups([
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
}

export function BucketPreviewActions(props: BucketPreviewActionsProps) {
  return Platform.OS === 'web' ? (
    <WebPreviewActions {...props} />
  ) : (
    <NativePreviewActions {...props} />
  );
}

// On a phone the overflow button opens a native menu.
function NativePreviewActions({ onOpen, onDelete }: BucketPreviewActionsProps) {
  const items = useMemo(
    () => actionGroupsToMenuItems(previewActionGroups({ onOpen, onDelete })),
    [onOpen, onDelete]
  );
  // A menu can't show a greyed-out command, so with nothing to run (the file
  // hasn't loaded and the viewer can't delete it) there's no button.
  if (items.length === 0) {
    return null;
  }
  return (
    <IconMenu
      items={items}
      accessibilityLabel="File actions"
      testID="BucketPreviewActions"
    >
      <OverflowMenuLabel />
    </IconMenu>
  );
}

function WebPreviewActions(props: BucketPreviewActionsProps) {
  const [open, setOpen] = useState(false);
  const { dismissThenRun, onDismissed, presentationKey } =
    useSheetDismissalAction({
      open,
      onOpenChange: setOpen,
      waitForDismissal: false,
    });
  return (
    <NotesActionMenu
      key={presentationKey}
      groups={previewActionGroups(props)}
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
