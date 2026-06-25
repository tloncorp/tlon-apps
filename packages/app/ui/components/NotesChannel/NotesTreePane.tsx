import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { ScrollView, YStack } from 'tamagui';

import { FolderTreeRow, NoteRow } from './NotesTreeRows';
import { getFolderLabel } from './notesTree';
import type { NotesTreeRow } from './notesTree';

type CreateAction = {
  canEdit: boolean;
  isCreating: boolean;
  onCreate: () => void;
};

export function NotesTreePane({
  canEdit,
  isDeletingFolder,
  isCreatingFolder,
  isCreatingNote,
  layout,
  selectedFolderId,
  selectedNoteId,
  treeRows,
  onCreate,
  onCreateFolderInFolder,
  onCreateNoteInFolder,
  onDeleteFolder,
  onDeleteNote,
  onMoveFolder,
  onMoveNote,
  onOpenNote,
  onRenameFolder,
  onToggleFolder,
}: {
  canEdit: boolean;
  isDeletingFolder: boolean;
  isCreatingFolder: boolean;
  isCreatingNote: boolean;
  layout: 'stack' | 'takeover';
  selectedFolderId: number | null;
  selectedNoteId: number | null;
  treeRows: NotesTreeRow[];
  onCreate: () => void;
  onCreateFolderInFolder: (folder: db.NotesFolder) => void;
  onCreateNoteInFolder: (folder: db.NotesFolder) => void;
  onDeleteFolder: (folder: db.NotesFolder) => void;
  onDeleteNote: (note: db.NotesNote) => void;
  onMoveFolder: (folder: db.NotesFolder) => void;
  onMoveNote: (note: db.NotesNote) => void;
  onOpenNote: (note: db.NotesNote) => void;
  onRenameFolder: (folder: db.NotesFolder) => void;
  onToggleFolder: (folderId: number, hasChildren: boolean) => void;
}) {
  const createAction = {
    canEdit,
    isCreating: isCreatingFolder || isCreatingNote,
    onCreate,
  };
  const treeList = (
    <NotesTreeRowsList
      canEdit={canEdit}
      isDeletingFolder={isDeletingFolder}
      createAction={createAction}
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
      onToggleFolder={onToggleFolder}
    />
  );

  if (layout === 'takeover') {
    return (
      <YStack flex={1} minHeight={0} backgroundColor="$background">
        {treeRows.length === 0 ? (
          <YStack
            flex={1}
            minHeight={0}
            alignItems="center"
            justifyContent="center"
          >
            <SidebarEmptyState createAction={createAction} centered />
          </YStack>
        ) : (
          <ScrollView flex={1}>
            <YStack paddingTop="$s" paddingBottom="$m">
              {treeList}
            </YStack>
          </ScrollView>
        )}
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
  createAction,
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
  onToggleFolder,
}: {
  canEdit: boolean;
  createAction: CreateAction;
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
  onToggleFolder: (folderId: number, hasChildren: boolean) => void;
}) {
  return (
    <YStack gap={2}>
      {treeRows.length === 0 ? (
        <SidebarEmptyState createAction={createAction} />
      ) : (
        treeRows.map((row) =>
          row.type === 'folder' ? (
            <FolderTreeRow
              key={row.folder.id}
              canEdit={canEdit}
              depth={row.depth}
              expanded={row.expanded}
              folder={row.folder}
              hasChildren={row.hasChildren}
              isDeleting={isDeletingFolder}
              label={getFolderLabel(row.folder)}
              noteCount={row.noteCount}
              selected={selectedFolderId === row.folder.folderId}
              onDelete={onDeleteFolder}
              onCreateFolder={onCreateFolderInFolder}
              onCreateNote={onCreateNoteInFolder}
              onMove={onMoveFolder}
              onPress={() =>
                onToggleFolder(row.folder.folderId, row.hasChildren)
              }
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
            />
          )
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

function SidebarEmptyState({
  centered = false,
  createAction,
}: {
  centered?: boolean;
  createAction: CreateAction;
}) {
  const action = createAction.canEdit ? (
    <Button
      size="small"
      fill="ghost"
      type="primary"
      leadingIcon="Add"
      label="New"
      loading={createAction.isCreating}
      onPress={createAction.onCreate}
    />
  ) : null;

  return (
    <YStack
      padding="$l"
      gap="$m"
      alignItems={centered ? 'center' : 'flex-start'}
    >
      <Text
        size="$label/m"
        color="$tertiaryText"
        letterSpacing={0}
        textAlign={centered ? 'center' : undefined}
      >
        No notes or folders
      </Text>
      {action}
    </YStack>
  );
}
