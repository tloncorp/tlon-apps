import type { Action } from '../ActionSheet';
import type { ScreenHeaderAction } from '../ScreenHeader';
import { ScreenHeaderItemElements } from '../ScreenHeader/primitives';

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

interface NotesHeaderActionOptions {
  canEdit: boolean;
  onNew: () => void;
  onSearch?: () => void;
  primaryActionVariant?: 'icon' | 'text';
}

export function createNotesHeaderActions({
  canEdit,
  onNew,
  onSearch,
  primaryActionVariant = 'text',
}: NotesHeaderActionOptions): ScreenHeaderAction[] {
  return [
    {
      id: 'NotesSearchHeaderAction',
      icon: 'Search',
      label: 'Search notes',
      onPress: onSearch,
      visible: !!onSearch,
      testID: 'NotesSearchHeaderAction',
    },
    {
      id: 'NotesRootNewHeaderAction',
      ...(primaryActionVariant === 'icon'
        ? { icon: 'Add' as const, label: 'New' }
        : { text: 'New' }),
      onPress: onNew,
      visible: canEdit,
      testID: 'NotesRootNewHeaderAction',
    },
  ];
}

export function NotesHeaderActions(props: NotesHeaderActionOptions) {
  return <ScreenHeaderItemElements actions={createNotesHeaderActions(props)} />;
}
