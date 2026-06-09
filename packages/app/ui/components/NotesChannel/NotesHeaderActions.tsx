import type { IconType } from '@tloncorp/ui';
import { useMemo } from 'react';
import type { MutableRefObject } from 'react';

import { createActionGroups } from '../ActionSheet';
import { NotesOverflowMenu } from './NotesCommon';
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
  const groups = useMemo(
    () =>
      createActionGroups(
        canEdit && [
          'neutral',
          {
            title: 'New',
            description: 'Create a note or folder.',
            startIcon: 'Add',
            action: () => openNewSheetRef.current(),
            testID: 'NotesRootNewAction',
          },
        ],
        [
          'neutral',
          ...NOTES_TREE_VIEW_OPTIONS.map((option) => ({
            title: option.title,
            description: option.description,
            startIcon: option.icon,
            endIcon:
              option.id === treeViewStyle ? ('Checkmark' as const) : undefined,
            selected: option.id === treeViewStyle,
            action: () => onTreeViewStyleChange(option.id),
            testID: `NotesTreeViewStyle-${option.id}`,
          })),
        ]
      ),
    [canEdit, onTreeViewStyleChange, openNewSheetRef, treeViewStyle]
  );

  return (
    <NotesOverflowMenu
      groups={groups}
      triggerTestID="NotesRootActionsTrigger"
    />
  );
}
