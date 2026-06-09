import type { IconType } from '@tloncorp/ui';
import { useMemo, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import type { Action } from '../ActionSheet';
import { ActionSheet } from '../ActionSheet';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import type { NotesTreeViewStyle } from './notesTree';

const NOTES_TREE_VIEW_OPTIONS: {
  id: NotesTreeViewStyle;
  title: string;
  description: string;
  icon: IconType;
}[] = [
  {
    id: 'outline',
    title: 'Normal',
    description: 'Balanced outline with guide rails.',
    icon: 'BulletList',
  },
  {
    id: 'notes',
    title: 'Comfortable',
    description: 'Roomier rows with folder counts.',
    icon: 'Folder',
  },
];

export function NotesHeaderActions({
  canEdit,
  openNewSheetRef,
  treeViewStyle,
  onTreeViewStyleChange,
}: {
  canEdit: boolean;
  openNewSheetRef: MutableRefObject<() => void>;
  treeViewStyle: NotesTreeViewStyle;
  onTreeViewStyleChange: (style: NotesTreeViewStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const newAction = useMemo<Action>(
    () => ({
      title: 'New',
      description: 'Create a note or folder.',
      startIcon: 'Add',
      action: () => {
        setOpen(false);
        openNewSheetRef.current();
      },
      testID: 'NotesRootNewAction',
    }),
    [openNewSheetRef]
  );
  const viewActions = useMemo<Action[]>(
    () =>
      NOTES_TREE_VIEW_OPTIONS.map((option) => ({
        title: option.title,
        description: option.description,
        startIcon: option.icon,
        endIcon: option.id === treeViewStyle ? 'Checkmark' : undefined,
        selected: option.id === treeViewStyle,
        action: () => {
          setOpen(false);
          onTreeViewStyleChange(option.id);
        },
        testID: `NotesTreeViewStyle-${option.id}`,
      })),
    [onTreeViewStyleChange, treeViewStyle]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={setOpen}
      mode={Platform.OS === 'web' ? 'popover' : 'sheet'}
      modal
      snapPointsMode="fit"
      trigger={
        <OverflowTriggerButton
          testID="NotesRootActionsTrigger"
          paddingHorizontal="$xs"
          paddingVertical="$xs"
          onPress={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        />
      }
    >
      <ActionSheet.Content>
        {canEdit ? (
          <ActionSheet.ActionGroup accent="neutral">
            <ActionSheet.Action action={newAction} testID={newAction.testID} />
          </ActionSheet.ActionGroup>
        ) : null}
        <ActionSheet.ActionGroup accent="neutral">
          {viewActions.map((action) => (
            <ActionSheet.Action
              key={action.title}
              action={action}
              testID={action.testID}
            />
          ))}
        </ActionSheet.ActionGroup>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
