import type { IconType } from '@tloncorp/ui';
import { Fragment, useMemo } from 'react';

import { createActionGroups } from '../ActionSheet';
import type { Action } from '../ActionSheet';
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

type NotesCreateActionOptions = Pick<Action, 'action' | 'disabled' | 'testID'>;

export function createNotesNewNoteAction({
  action,
  disabled,
  testID,
}: NotesCreateActionOptions): Action {
  return {
    title: 'New note',
    description: 'Create a note in the selected folder.',
    startIcon: 'ChannelNote',
    action,
    disabled,
    testID,
  };
}

export function createNotesNewFolderAction({
  action,
  disabled,
  testID,
}: NotesCreateActionOptions): Action {
  return {
    title: 'New folder',
    description: 'Create a folder under the selected folder.',
    startIcon: 'Folder',
    action,
    disabled,
    testID,
  };
}

export function NotesHeaderActions({
  canEdit,
  canImportFiles,
  canImportFolder,
  isCreatingFolder,
  isCreatingNote,
  isImporting,
  onCreateFolder,
  onCreateNote,
  onImportFiles,
  onImportFolder,
  primaryActionVariant = 'text',
  treeViewStyle,
  onTreeViewStyleChange,
}: {
  canEdit: boolean;
  canImportFiles: boolean;
  canImportFolder: boolean;
  isCreatingFolder: boolean;
  isCreatingNote: boolean;
  isImporting: boolean;
  onCreateFolder: () => void;
  onCreateNote: () => Promise<void> | void;
  onImportFiles: () => void;
  onImportFolder: () => void;
  primaryActionVariant?: 'icon' | 'text';
  treeViewStyle: NotesTreeViewStyle;
  onTreeViewStyleChange: (style: NotesTreeViewStyle) => void;
}) {
  const groups = useMemo(
    () =>
      createActionGroups(
        canEdit && [
          'neutral',
          createNotesNewNoteAction({
            action: () => void onCreateNote(),
            disabled: isCreatingNote,
            testID: 'NotesRootNewNoteAction',
          }),
          createNotesNewFolderAction({
            action: onCreateFolder,
            disabled: isCreatingFolder,
            testID: 'NotesRootNewFolderAction',
          }),
        ],
        (canImportFiles || canImportFolder) && [
          'neutral',
          canImportFiles && {
            title: 'Import',
            description: 'Import markdown or text files.',
            startIcon: 'ArrowDown',
            action: onImportFiles,
            disabled: isImporting,
            testID: 'NotesImportFilesAction',
          },
          canImportFolder && {
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
      canImportFiles,
      canImportFolder,
      isCreatingFolder,
      isCreatingNote,
      isImporting,
      onCreateFolder,
      onCreateNote,
      onImportFiles,
      onImportFolder,
      onTreeViewStyleChange,
      treeViewStyle,
    ]
  );

  return (
    <Fragment>
      {canEdit && primaryActionVariant === 'icon' ? (
        <ScreenHeader.IconButton
          aria-label="New note"
          color={isCreatingNote ? '$tertiaryText' : '$primaryText'}
          onPress={isCreatingNote ? undefined : () => void onCreateNote()}
          testID="NotesRootNewHeaderAction"
          type="Add"
        />
      ) : canEdit ? (
        <ScreenHeader.TextButton
          disabled={isCreatingNote}
          onPress={isCreatingNote ? undefined : () => void onCreateNote()}
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
