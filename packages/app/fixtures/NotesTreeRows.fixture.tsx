import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useFixtureSelect, useValue } from 'react-cosmos/client';

import { ScrollView, View, XStack, YStack } from '../ui';
import {
  FolderTreeRow,
  NoteRow,
} from '../ui/components/NotesChannel/NotesTreeRows';
import {
  buildFolderNoteCounts,
  buildNotesTreeRows,
  getFolderLabel,
} from '../ui/components/NotesChannel/notesTree';
import type { NotesTreeViewStyle } from '../ui/components/NotesChannel/notesTree';
import { FixtureWrapper } from './FixtureWrapper';

const notebookFlag = '~zod/native-notes-fixture';
const notebookId = 42;
const now = 1_762_000_000_000;

const folders: db.NotesFolder[] = [
  folder(1, '/', null),
  folder(2, 'Projects', 1),
  folder(3, 'Launch notes', 2),
  folder(4, 'Long folder name that should truncate gracefully', 2),
  folder(5, 'Ideas', 1),
  folder(6, 'Archive', 1),
  folder(7, 'Empty folder', 1),
];

const notes: db.NotesNote[] = [
  note(101, 1, 'Notebook overview', now - 4 * 60 * 60 * 1000),
  note(102, 2, 'Roadmap draft', now - 26 * 60 * 60 * 1000),
  note(103, 3, 'Meeting notes with a very long title that needs room', now),
  note(104, 3, 'Follow-ups', now - 5 * 24 * 60 * 60 * 1000),
  note(105, 4, 'Visual polish checklist', now - 11 * 24 * 60 * 60 * 1000),
  note(106, 5, 'Untitled', null),
  note(107, 6, 'Historical context', now - 72 * 24 * 60 * 60 * 1000),
];

const expandedFolderIds = new Set(folders.map((item) => item.folderId));
const folderNoteCounts = buildFolderNoteCounts(folders, notes);
const treeRows = buildNotesTreeRows({
  expandedFolderIds,
  folderNoteCounts,
  folders,
  notes,
  rootFolderId: 1,
});

function NotesTreeRowsFixture() {
  const [previewStyle] = useFixtureSelect('Preview style', {
    options: ['both', 'notes', 'outline'],
  });
  const [selectedRow] = useFixtureSelect('Selected row', {
    options: ['note', 'folder', 'none'],
  });
  const [listWidthValue] = useValue('List width', {
    defaultValue: 324,
  });
  const [canEdit] = useValue('Can edit', {
    defaultValue: true,
  });
  const listWidth = getNumberControl(listWidthValue, 324);
  const styles: NotesTreeViewStyle[] =
    previewStyle === 'both'
      ? ['notes', 'outline']
      : [previewStyle as NotesTreeViewStyle];

  return (
    <FixtureWrapper
      fillHeight
      fillWidth
      verticalAlign="top"
      backgroundColor="$secondaryBackground"
    >
      <ScrollView width="100%" height="100%">
        <YStack padding="$xl" gap="$xl" alignItems="flex-start">
          <XStack gap="$xl" alignItems="flex-start" flexWrap="wrap">
            {styles.map((style) => (
              <RowsPreview
                key={style}
                canEdit={canEdit}
                listWidth={listWidth}
                selectedRow={selectedRow}
                viewStyle={style}
              />
            ))}
          </XStack>
        </YStack>
      </ScrollView>
    </FixtureWrapper>
  );
}

function RowsPreview({
  canEdit,
  listWidth,
  selectedRow,
  viewStyle,
}: {
  canEdit: boolean;
  listWidth: number;
  selectedRow: string;
  viewStyle: NotesTreeViewStyle;
}) {
  const title = viewStyle === 'notes' ? 'Notes rows' : 'Outline rows';

  return (
    <YStack gap="$s" width={listWidth} minWidth={280} maxWidth="100%">
      <Text size="$label/m" color="$secondaryText" fontWeight="600">
        {title}
      </Text>
      <View backgroundColor="$background" overflow="hidden">
        {treeRows.map((row) => {
          if (row.type === 'folder') {
            const label = getFolderLabel(row.folder);
            return (
              <FolderTreeRow
                key={`folder-${row.folder.folderId}`}
                canEdit={canEdit}
                depth={row.depth}
                expanded={row.expanded}
                folder={row.folder}
                hasChildren={row.hasChildren}
                isDeleting={false}
                label={label}
                noteCount={row.noteCount}
                selected={selectedRow === 'folder' && row.folder.folderId === 3}
                viewStyle={viewStyle}
                onDelete={() => {}}
                onMove={() => {}}
                onPress={() => {}}
                onRename={() => {}}
              />
            );
          }

          return (
            <NoteRow
              key={`note-${row.note.noteId}`}
              canEdit={canEdit}
              depth={row.depth}
              note={row.note}
              selected={selectedRow === 'note' && row.note.noteId === 103}
              viewStyle={viewStyle}
              onDelete={() => {}}
              onMove={() => {}}
              onPress={() => {}}
            />
          );
        })}
      </View>
    </YStack>
  );
}

function getNumberControl(value: number, defaultValue: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function folder(
  folderId: number,
  name: string,
  parentFolderId: number | null
): db.NotesFolder {
  return {
    id: `${notebookFlag}/folder/${folderId}`,
    notebookFlag,
    folderId,
    notebookId,
    name,
    parentFolderId,
    createdBy: '~zod',
    createdAt: now - folderId * 60 * 60 * 1000,
    updatedBy: '~zod',
    updatedAt: now - folderId * 30 * 60 * 1000,
    syncedAt: now,
  };
}

function note(
  noteId: number,
  folderId: number,
  title: string,
  updatedAt: number | null
): db.NotesNote {
  return {
    id: `${notebookFlag}/note/${noteId}`,
    notebookFlag,
    noteId,
    notebookId,
    folderId,
    title: title === 'Untitled' ? '' : title,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    bodyMd: getFixtureBody(noteId),
    createdBy: '~zod',
    createdAt: now - noteId * 60 * 60 * 1000,
    updatedBy: '~zod',
    updatedAt,
    revision: noteId,
    syncedAt: now,
  };
}

function getFixtureBody(noteId: number) {
  switch (noteId) {
    case 101:
      return 'A quick map of the notebook structure, open questions, and the next decisions for the team.';
    case 102:
      return '## Priorities\n- tighten the desktop tree\n- finish import flows\n- confirm permissions smoke coverage';
    case 103:
      return 'Reviewed the sidebar options and landed on a focused tree-first layout for desktop. Need one more pass on spacing.';
    case 104:
      return 'Ping design on icon sizing, then test note creation and folder movement against the smoke notebook.';
    case 105:
      return 'Small spacing pass: right padding, hover affordances, selected row weight, and clearer folder counts.';
    case 107:
      return '[Reference notes](https://example.com) from the first pass, plus things that changed after Hunter merged groups integration.';
    default:
      return '';
  }
}

export default {
  'tree row preview': <NotesTreeRowsFixture />,
};
