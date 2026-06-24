import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import type { ComponentProps } from 'react';
import { ScrollView, YStack } from 'tamagui';

import { TextInput } from '../Form';
import { FolderTreeRow, NoteRow } from './NotesTreeRows';
import { getFolderLabel } from './notesTree';
import type { NotesTreeRow } from './notesTree';

type CreateAction = {
  canEdit: boolean;
  isCreating: boolean;
  onCreate: () => void;
};

const sidebarSearchFrameStyle: ComponentProps<typeof TextInput>['frameStyle'] =
  {
    height: '$5xl',
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '$border',
  };

export function NotesTreePane({
  canEdit,
  isDeletingFolder,
  isCreatingFolder,
  isCreatingNote,
  layout,
  normalizedQuery,
  notesFilterQuery,
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
  onQueryChange,
  onRenameFolder,
  onToggleFolder,
}: {
  canEdit: boolean;
  isDeletingFolder: boolean;
  isCreatingFolder: boolean;
  isCreatingNote: boolean;
  layout: 'stack' | 'takeover';
  normalizedQuery: string;
  notesFilterQuery: string;
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
  onQueryChange: (query: string) => void;
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
      normalizedQuery={normalizedQuery}
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
        <NotesTreeSearchInput
          query={notesFilterQuery}
          onQueryChange={onQueryChange}
          presentation="sidebar"
        />
        {treeRows.length === 0 ? (
          <YStack
            flex={1}
            minHeight={0}
            alignItems="center"
            justifyContent="center"
          >
            <SidebarEmptyState
              createAction={createAction}
              normalizedQuery={normalizedQuery}
              centered
            />
          </YStack>
        ) : (
          <ScrollView flex={1}>
            <YStack paddingBottom="$m">{treeList}</YStack>
          </ScrollView>
        )}
      </YStack>
    );
  }

  return (
    <>
      <YStack
        width="100%"
        maxWidth={760}
        marginHorizontal="auto"
        paddingLeft="$s"
        paddingRight="$s"
        paddingTop="$m"
        paddingBottom="$s"
        backgroundColor="$background"
      >
        <NotesTreeSearchInput
          query={notesFilterQuery}
          onQueryChange={onQueryChange}
        />
      </YStack>

      <ScrollView flex={1}>
        <YStack
          width="100%"
          maxWidth={760}
          marginHorizontal="auto"
          paddingLeft="$s"
          paddingRight="$s"
          paddingTop="$s"
          paddingBottom="$m"
        >
          {treeList}
        </YStack>
      </ScrollView>
    </>
  );
}

function NotesTreeRowsList({
  canEdit,
  createAction,
  isDeletingFolder,
  normalizedQuery,
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
  normalizedQuery: string;
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
        <SidebarEmptyState
          createAction={createAction}
          normalizedQuery={normalizedQuery}
        />
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
  normalizedQuery,
}: {
  centered?: boolean;
  createAction: CreateAction;
  normalizedQuery: string;
}) {
  const title = normalizedQuery
    ? 'No matching notes or folders'
    : 'No notes or folders';
  const action =
    !normalizedQuery && createAction.canEdit ? (
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
        {title}
      </Text>
      {action}
    </YStack>
  );
}

function NotesTreeSearchInput({
  query,
  onQueryChange,
  presentation = 'card',
}: {
  query: string;
  onQueryChange: (query: string) => void;
  presentation?: 'card' | 'sidebar';
}) {
  return (
    <TextInput
      icon="Search"
      placeholder="Search notes"
      value={query}
      onChangeText={onQueryChange}
      spellCheck={false}
      autoCorrect={false}
      autoCapitalize="none"
      testID="NotesTreeSearchInput"
      frameStyle={
        presentation === 'sidebar' ? sidebarSearchFrameStyle : undefined
      }
      rightControls={
        query !== '' ? (
          <TextInput.InnerButton
            label="Clear"
            onPress={() => onQueryChange('')}
          />
        ) : null
      }
    />
  );
}
