import type { IconType } from '@tloncorp/ui';
import { Fragment, useMemo } from 'react';
import type { MutableRefObject } from 'react';

import { createActionGroups } from '../ActionSheet';
import { ScreenHeader } from '../ScreenHeader';
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
  canImport,
  isImporting,
  onImportFiles,
  onImportFolder,
  openNewSheetRef,
  treeViewStyle,
  onTreeViewStyleChange,
}: {
  canEdit: boolean;
  canImport: boolean;
  isImporting: boolean;
  onImportFiles: () => void;
  onImportFolder: () => void;
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
        canImport && [
          'neutral',
          {
            title: 'Import',
            description: 'Import markdown or text files.',
            startIcon: 'ArrowDown',
            action: onImportFiles,
            disabled: isImporting,
            testID: 'NotesImportFilesAction',
          },
          {
            title: 'Import folder',
            description: 'Import a folder of markdown or text files.',
            startIcon: 'Folder',
            action: onImportFolder,
            disabled: isImporting,
            testID: 'NotesImportFolderAction',
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
    [
      canEdit,
      canImport,
      isImporting,
      onImportFiles,
      onImportFolder,
      onTreeViewStyleChange,
      openNewSheetRef,
      treeViewStyle,
    ]
  );

  return (
    <Fragment>
      {canEdit ? (
        <ScreenHeader.TextButton
          onPress={() => openNewSheetRef.current()}
          testID="NotesRootNewHeaderAction"
        >
          New
        </ScreenHeader.TextButton>
      ) : null}
      <NotesOverflowMenu
        groups={groups}
        triggerTestID="NotesRootActionsTrigger"
      />
    </Fragment>
  );
}
