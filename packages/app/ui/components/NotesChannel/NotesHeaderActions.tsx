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
  isCreatingFolder,
  isCreatingNote,
  onCreateFolder,
  onCreateNote,
  primaryActionVariant = 'text',
}: {
  canEdit: boolean;
  isCreatingFolder: boolean;
  isCreatingNote: boolean;
  onCreateFolder: () => void;
  onCreateNote: () => Promise<void> | void;
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
