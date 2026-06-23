import { createActionGroups } from '../ActionSheet';
import type { Action } from '../ActionSheet';
import { ScreenHeader } from '../ScreenHeader';
import { NotesOverflowMenu } from './NotesCommon';

type NotesCreateActionOptions = Pick<Action, 'action' | 'disabled' | 'testID'>;

export function createNotesNewNoteAction(
  options: NotesCreateActionOptions
): Action {
  return { ...options, title: 'New note', startIcon: 'ChannelNote' };
}

export function createNotesNewFolderAction(
  options: NotesCreateActionOptions
): Action {
  return { ...options, title: 'New folder', startIcon: 'Folder' };
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
}) {
  const groups = createActionGroups(
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
        startIcon: 'ArrowDown',
        action: onImportFiles,
        disabled: isImporting,
        testID: 'NotesImportFilesAction',
      },
      canImportFolder && {
        title: 'Import folder',
        startIcon: 'Folder',
        action: onImportFolder,
        disabled: isImporting,
        testID: 'NotesImportFolderAction',
      },
    ]
  );

  return (
    <>
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
      {groups.length > 0 ? (
        <NotesOverflowMenu
          groups={groups}
          triggerTestID="NotesRootActionsTrigger"
        />
      ) : null}
    </>
  );
}
