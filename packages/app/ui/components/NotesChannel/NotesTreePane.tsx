import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { ScrollView, YStack } from 'tamagui';

import { FolderTreeRow, NoteRow } from './NotesTreeRows';
import { getFolderLabel } from './notesTree';
import type { NotesTreeRow } from './notesTree';

export function NotesTreePane({
  canEdit,
  isDeletingFolder,
  isNotePublished,
  getPublishedNoteUrl,
  layout,
  publishDisabled,
  publishingAction,
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
  onPublishNote,
  onRenameFolder,
  onToggleFolder,
  onUnpublishNote,
  onViewPublishedNote,
}: {
  canEdit: boolean;
  isDeletingFolder: boolean;
  isNotePublished: (noteId: number) => boolean;
  getPublishedNoteUrl?: (note: db.NotesNote) => string | null;
  layout: 'stack' | 'takeover';
  publishDisabled: boolean;
  publishingAction: 'publish' | 'unpublish' | null;
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
  onPublishNote: (note: db.NotesNote) => void;
  onRenameFolder: (folder: db.NotesFolder) => void;
  onToggleFolder: (folderId: number, hasChildren: boolean) => void;
  onUnpublishNote: (note: db.NotesNote) => void;
  onViewPublishedNote?: (note: db.NotesNote) => void;
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
      getPublishedNoteUrl={getPublishedNoteUrl}
      isNotePublished={isNotePublished}
      selectedFolderId={selectedFolderId}
      selectedNoteId={selectedNoteId}
      publishDisabled={publishDisabled}
      publishingAction={publishingAction}
      treeRows={treeRows}
      onCreateFolderInFolder={onCreateFolderInFolder}
      onCreateNoteInFolder={onCreateNoteInFolder}
      onDeleteFolder={onDeleteFolder}
      onDeleteNote={onDeleteNote}
      onMoveFolder={onMoveFolder}
      onMoveNote={onMoveNote}
      onOpenNote={onOpenNote}
      onPublishNote={onPublishNote}
      onRenameFolder={onRenameFolder}
      onToggleFolder={onToggleFolder}
      onUnpublishNote={onUnpublishNote}
      onViewPublishedNote={onViewPublishedNote}
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
  getPublishedNoteUrl,
  isDeletingFolder,
  isNotePublished,
  publishDisabled,
  publishingAction,
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
  onPublishNote,
  onRenameFolder,
  onToggleFolder,
  onUnpublishNote,
  onViewPublishedNote,
}: {
  canEdit: boolean;
  getPublishedNoteUrl?: (note: db.NotesNote) => string | null;
  isDeletingFolder: boolean;
  isNotePublished: (noteId: number) => boolean;
  publishDisabled: boolean;
  publishingAction: 'publish' | 'unpublish' | null;
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
  onPublishNote: (note: db.NotesNote) => void;
  onRenameFolder: (folder: db.NotesFolder) => void;
  onToggleFolder: (folderId: number, hasChildren: boolean) => void;
  onUnpublishNote: (note: db.NotesNote) => void;
  onViewPublishedNote?: (note: db.NotesNote) => void;
}) {
  return (
    <YStack gap={2}>
      {treeRows.map((row) =>
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
            onPress={() => onToggleFolder(row.folder.folderId, row.hasChildren)}
            onRename={onRenameFolder}
          />
        ) : (
          <NoteRow
            key={row.note.id}
            canEdit={canEdit}
            depth={row.depth}
            isPublished={isNotePublished(row.note.noteId)}
            note={row.note}
            publishDisabled={publishDisabled}
            publishedUrl={
              isNotePublished(row.note.noteId)
                ? getPublishedNoteUrl?.(row.note) ?? null
                : null
            }
            publishingAction={publishingAction}
            selected={selectedNoteId === row.note.noteId}
            onDelete={() => onDeleteNote(row.note)}
            onMove={() => onMoveNote(row.note)}
            onPress={() => onOpenNote(row.note)}
            onPublish={() => onPublishNote(row.note)}
            onUnpublish={() => onUnpublishNote(row.note)}
            onViewPublished={
              onViewPublishedNote
                ? () => onViewPublishedNote(row.note)
                : undefined
            }
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
