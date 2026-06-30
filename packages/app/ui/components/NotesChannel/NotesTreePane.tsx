import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { ScrollView, YStack } from 'tamagui';

import { FolderTreeRow, NoteRow } from './NotesTreeRows';
import { getFolderLabel } from './notesTree';
import type { NotesTreeRow } from './notesTree';

export function NotesTreePane({
  canEdit,
  isDeletingFolder,
  layout,
  selectedFolderId,
  selectedNoteId,
  treeRows,
  onCreateFolderInFolder,
  onCreateNoteInFolder,
  onDeleteFolder,
  onDeleteNote,
  onMoveFolder,
  onMoveNote,
  onOpenNote,
  onRenameFolder,
  onRenameNote,
  onOpenFolder,
}: {
  canEdit: boolean;
  isDeletingFolder: boolean;
  layout: 'stack' | 'takeover';
  selectedFolderId: number | null;
  selectedNoteId: number | null;
  treeRows: NotesTreeRow[];
  onCreateFolderInFolder: (folder: db.NotesFolder) => void;
  onCreateNoteInFolder: (folder: db.NotesFolder) => void;
  onDeleteFolder: (folder: db.NotesFolder) => void;
  onDeleteNote: (note: db.NotesNote) => void;
  onMoveFolder: (folder: db.NotesFolder) => void;
  onMoveNote: (note: db.NotesNote) => void;
  onOpenNote: (note: db.NotesNote) => void;
  onRenameFolder: (folder: db.NotesFolder) => void;
  onRenameNote: (note: db.NotesNote) => void;
  onOpenFolder: (folder: db.NotesFolder) => void;
}) {
  if (treeRows.length === 0) {
    return (
      <YStack
        flex={1}
        minHeight={0}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
      >
        <SidebarEmptyState />
      </YStack>
    );
  }

  const treeList = (
    <NotesTreeRowsList
      canEdit={canEdit}
      isDeletingFolder={isDeletingFolder}
      selectedFolderId={selectedFolderId}
      selectedNoteId={selectedNoteId}
      treeRows={treeRows}
      onCreateFolderInFolder={onCreateFolderInFolder}
      onCreateNoteInFolder={onCreateNoteInFolder}
      onDeleteFolder={onDeleteFolder}
      onDeleteNote={onDeleteNote}
      onMoveFolder={onMoveFolder}
      onMoveNote={onMoveNote}
      onOpenNote={onOpenNote}
      onRenameFolder={onRenameFolder}
      onRenameNote={onRenameNote}
      onOpenFolder={onOpenFolder}
    />
  );

  if (layout === 'takeover') {
    return (
      <YStack flex={1} minHeight={0} backgroundColor="$background">
        <ScrollView flex={1}>
          <YStack paddingTop="$s" paddingBottom="$m">
            {treeList}
          </YStack>
        </ScrollView>
      </YStack>
    );
  }

  return (
    <ScrollView flex={1}>
      <YStack
        width="100%"
        maxWidth={760}
        marginHorizontal="auto"
        paddingLeft="$s"
        paddingRight="$s"
        paddingTop="$m"
        paddingBottom="$m"
      >
        {treeList}
      </YStack>
    </ScrollView>
  );
}

function NotesTreeRowsList({
  canEdit,
  isDeletingFolder,
  selectedFolderId,
  selectedNoteId,
  treeRows,
  onCreateFolderInFolder,
  onCreateNoteInFolder,
  onDeleteFolder,
  onDeleteNote,
  onMoveFolder,
  onMoveNote,
  onOpenNote,
  onRenameFolder,
  onRenameNote,
  onOpenFolder,
}: {
  canEdit: boolean;
  isDeletingFolder: boolean;
  selectedFolderId: number | null;
  selectedNoteId: number | null;
  treeRows: NotesTreeRow[];
  onCreateFolderInFolder: (folder: db.NotesFolder) => void;
  onCreateNoteInFolder: (folder: db.NotesFolder) => void;
  onDeleteFolder: (folder: db.NotesFolder) => void;
  onDeleteNote: (note: db.NotesNote) => void;
  onMoveFolder: (folder: db.NotesFolder) => void;
  onMoveNote: (note: db.NotesNote) => void;
  onOpenNote: (note: db.NotesNote) => void;
  onRenameFolder: (folder: db.NotesFolder) => void;
  onRenameNote: (note: db.NotesNote) => void;
  onOpenFolder: (folder: db.NotesFolder) => void;
}) {
  return (
    <YStack>
      {treeRows.map((row) =>
        row.type === 'folder' ? (
          <FolderTreeRow
            key={row.folder.id}
            canEdit={canEdit}
            depth={row.depth}
            folder={row.folder}
            isDeleting={isDeletingFolder}
            label={getFolderLabel(row.folder)}
            noteCount={row.noteCount}
            selected={selectedFolderId === row.folder.folderId}
            onDelete={onDeleteFolder}
            onCreateFolder={onCreateFolderInFolder}
            onCreateNote={onCreateNoteInFolder}
            onMove={onMoveFolder}
            onPress={() => onOpenFolder(row.folder)}
            onRename={onRenameFolder}
          />
        ) : (
          <NoteRow
            key={row.note.id}
            canEdit={canEdit}
            depth={row.depth}
            note={row.note}
            selected={selectedNoteId === row.note.noteId}
            onDelete={() => onDeleteNote(row.note)}
            onMove={() => onMoveNote(row.note)}
            onPress={() => onOpenNote(row.note)}
            onRename={() => onRenameNote(row.note)}
          />
        )
      )}
    </YStack>
  );
}

export function NotesEmptyDetailPane({
  canEdit,
  isCreating,
  onCreateNote,
}: {
  canEdit: boolean;
  isCreating: boolean;
  onCreateNote: () => void;
}) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$2xl">
      <YStack gap="$m" alignItems="center" maxWidth={280}>
        <Text size="$label/l" color="$secondaryText" textAlign="center">
          Select a note
        </Text>
        {canEdit ? (
          <Button
            size="small"
            fill="outline"
            type="primary"
            leadingIcon="Add"
            label="New note"
            loading={isCreating}
            onPress={onCreateNote}
          />
        ) : null}
      </YStack>
    </YStack>
  );
}

function SidebarEmptyState() {
  return (
    <YStack alignItems="center" padding="$l">
      <Text
        size="$label/m"
        color="$tertiaryText"
        letterSpacing={0}
        textAlign="center"
      >
        No notes or folders
      </Text>
    </YStack>
  );
}
