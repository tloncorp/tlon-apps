import type { Action } from '../ActionSheet';
import { ScreenHeader } from '../ScreenHeader';

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
  onNew,
  primaryActionVariant = 'text',
}: {
  canEdit: boolean;
  onNew: () => void;
  primaryActionVariant?: 'icon' | 'text';
}) {
  return (
    <>
      {canEdit && primaryActionVariant === 'icon' ? (
        <ScreenHeader.IconButton
          aria-label="New"
          color="$primaryText"
          onPress={onNew}
          testID="NotesRootNewHeaderAction"
          type="Add"
        />
      ) : canEdit ? (
        <ScreenHeader.TextButton
          onPress={onNew}
          testID="NotesRootNewHeaderAction"
        >
          New
        </ScreenHeader.TextButton>
      ) : null}
    </>
  );
}
