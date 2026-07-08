import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { ScrollView, YStack } from 'tamagui';

import { FolderTreeRow, NoteRow } from './NotesTreeRows';
import { getFolderLabel } from './notesTree';
import type { NotesTreeRow } from './notesTree';

export function NotesTreePane({
  canEdit,
  getPublishedNoteUrl,
  isDeletingFolder,
  isNotePublished,
  layout,
  publishDisabled,
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
  onRenameNote,
  onOpenFolder,
  onUnpublishNote,
  onViewPublishedNote,
}: {
  canEdit: boolean;
  getPublishedNoteUrl?: (note: db.NotesNote) => string | null;
  isDeletingFolder: boolean;
  isNotePublished: (noteId: number) => boolean;
  layout: 'stack' | 'takeover';
  publishDisabled: boolean;
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
  onRenameNote: (note: db.NotesNote) => void;
  onOpenFolder: (folder: db.NotesFolder) => void;
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
    <YStack>
      {treeRows.map((row) =>
        row.type === 'folder' ? (
          <FolderTreeRow
            key={row.folder.id}
            canEdit={canEdit}
            folder={row.folder}
            isDeleting={isDeletingFolder}
            label={getFolderLabel(row.folder)}
            noteCount={row.noteCount}
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
            isPublished={isNotePublished(row.note.noteId)}
            note={row.note}
            publishDisabled={publishDisabled}
            publishedUrl={
              isNotePublished(row.note.noteId)
                ? (getPublishedNoteUrl?.(row.note) ?? null)
                : null
            }
            selected={selectedNoteId === row.note.noteId}
            onDelete={() => onDeleteNote(row.note)}
            onMove={() => onMoveNote(row.note)}
            onPress={() => onOpenNote(row.note)}
            onPublish={() => onPublishNote(row.note)}
            onRename={() => onRenameNote(row.note)}
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

  if (layout === 'takeover') {
    return (
      <YStack flex={1} minHeight={0} backgroundColor="$background">
        <ScrollView flex={1}>
          <YStack paddingTop="$l" paddingHorizontal="$l" paddingBottom="$m">
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
        paddingLeft="$l"
        paddingRight="$l"
        paddingTop="$m"
        paddingBottom="$m"
      >
        {treeList}
      </YStack>
    </ScrollView>
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
