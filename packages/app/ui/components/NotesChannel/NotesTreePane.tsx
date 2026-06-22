import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, YStack } from 'tamagui';

import { TextInput } from '../Form';
import { FolderTreeRow, NoteRow } from './NotesTreeRows';
import { getFolderLabel } from './notesTree';
import type { NotesTreeRow, NotesTreeViewStyle } from './notesTree';

function NotesContentFrame({
  viewStyle,
  children,
  ...props
}: {
  viewStyle: NotesTreeViewStyle;
  children: ReactNode;
} & Omit<ComponentProps<typeof YStack>, 'children'>) {
  return (
    <YStack
      width="100%"
      maxWidth={760}
      marginHorizontal="auto"
      paddingLeft={viewStyle === 'notes' ? '$m' : '$s'}
      paddingRight={viewStyle === 'notes' ? '$m' : '$s'}
      {...props}
    >
      {children}
    </YStack>
  );
}

export function NotesTreePane({
  canEdit,
  isCreatingFolder,
  isCreatingNote,
  layout,
  normalizedQuery,
  notesFilterQuery,
  selectedFolderId,
  selectedNoteId,
  treeRows,
  treeViewStyle,
  onClearSearch,
  onCreate,
  onDeleteNote,
  onFolderActions,
  onMoveNote,
  onOpenNote,
  onQueryChange,
  onToggleFolder,
}: {
  canEdit: boolean;
  isCreatingFolder: boolean;
  isCreatingNote: boolean;
  layout: 'stack' | 'takeover';
  normalizedQuery: string;
  notesFilterQuery: string;
  selectedFolderId: number | null;
  selectedNoteId: number | null;
  treeRows: NotesTreeRow[];
  treeViewStyle: NotesTreeViewStyle;
  onClearSearch: () => void;
  onCreate: () => void;
  onDeleteNote: (note: db.NotesNote) => void;
  onFolderActions: (folder: db.NotesFolder) => void;
  onMoveNote: (note: db.NotesNote) => void;
  onOpenNote: (note: db.NotesNote) => void;
  onQueryChange: (query: string) => void;
  onToggleFolder: (folderId: number, hasChildren: boolean) => void;
}) {
  const rowViewStyle = layout === 'takeover' ? 'notes' : treeViewStyle;
  const treeList = (
    <NotesTreeRowsList
      canEdit={canEdit}
      isCreatingFolder={isCreatingFolder}
      isCreatingNote={isCreatingNote}
      normalizedQuery={normalizedQuery}
      selectedFolderId={selectedFolderId}
      selectedNoteId={selectedNoteId}
      treeRows={treeRows}
      treeViewStyle={rowViewStyle}
      onClearSearch={onClearSearch}
      onCreate={onCreate}
      onDeleteNote={onDeleteNote}
      onFolderActions={onFolderActions}
      onMoveNote={onMoveNote}
      onOpenNote={onOpenNote}
      onToggleFolder={onToggleFolder}
      presentation={layout === 'takeover' ? 'divider' : 'card'}
    />
  );

  if (layout === 'takeover') {
    return (
      <YStack flex={1} minHeight={0} backgroundColor="$background">
        <YStack paddingHorizontal="$m" paddingTop="$m" paddingBottom="$xs">
          <NotesTreeSearchInput
            query={notesFilterQuery}
            onQueryChange={onQueryChange}
          />
        </YStack>
        <ScrollView flex={1}>
          <YStack paddingBottom="$m">{treeList}</YStack>
        </ScrollView>
      </YStack>
    );
  }

  return (
    <>
      <NotesContentFrame
        viewStyle={treeViewStyle}
        paddingTop={treeViewStyle === 'notes' ? '$l' : '$m'}
        paddingBottom="$s"
        backgroundColor="$background"
      >
        <NotesTreeSearchInput
          query={notesFilterQuery}
          onQueryChange={onQueryChange}
        />
      </NotesContentFrame>

      <ScrollView flex={1}>
        <NotesContentFrame
          viewStyle={treeViewStyle}
          paddingTop="$s"
          paddingBottom={treeViewStyle === 'notes' ? '$l' : '$m'}
        >
          {treeList}
        </NotesContentFrame>
      </ScrollView>
    </>
  );
}

function NotesTreeRowsList({
  canEdit,
  isCreatingFolder,
  isCreatingNote,
  normalizedQuery,
  selectedFolderId,
  selectedNoteId,
  treeRows,
  treeViewStyle,
  onClearSearch,
  onCreate,
  onDeleteNote,
  onFolderActions,
  onMoveNote,
  onOpenNote,
  onToggleFolder,
  presentation = 'card',
}: {
  canEdit: boolean;
  isCreatingFolder: boolean;
  isCreatingNote: boolean;
  normalizedQuery: string;
  selectedFolderId: number | null;
  selectedNoteId: number | null;
  treeRows: NotesTreeRow[];
  treeViewStyle: NotesTreeViewStyle;
  onClearSearch: () => void;
  onCreate: () => void;
  onDeleteNote: (note: db.NotesNote) => void;
  onFolderActions: (folder: db.NotesFolder) => void;
  onMoveNote: (note: db.NotesNote) => void;
  onOpenNote: (note: db.NotesNote) => void;
  onToggleFolder: (folderId: number, hasChildren: boolean) => void;
  presentation?: 'card' | 'divider';
}) {
  const isNotesView = treeViewStyle === 'notes';
  const isDividerPresentation = isNotesView && presentation === 'divider';

  return (
    <YStack
      gap={isNotesView ? 0 : 2}
      borderColor={
        isNotesView && !isDividerPresentation ? '$border' : 'transparent'
      }
      borderWidth={isNotesView && !isDividerPresentation ? 1 : 0}
      borderRadius={isNotesView && !isDividerPresentation ? '$m' : 0}
      borderTopColor={isDividerPresentation ? '$border' : 'transparent'}
      borderTopWidth={isDividerPresentation ? 1 : 0}
      overflow={isNotesView && !isDividerPresentation ? 'hidden' : 'visible'}
      backgroundColor={isNotesView ? '$background' : 'transparent'}
    >
      {treeRows.length === 0 ? (
        <SidebarEmpty
          title={
            normalizedQuery
              ? 'No matching notes or folders'
              : 'No notes or folders'
          }
          action={
            normalizedQuery ? (
              <Button
                size="small"
                fill="ghost"
                type="secondary"
                leadingIcon="Close"
                label="Clear search"
                onPress={onClearSearch}
              />
            ) : canEdit ? (
              <Button
                size="small"
                fill="ghost"
                type="primary"
                leadingIcon="Add"
                label="New"
                loading={isCreatingNote || isCreatingFolder}
                onPress={onCreate}
              />
            ) : null
          }
        />
      ) : (
        treeRows.map((row) =>
          row.type === 'folder' ? (
            <FolderTreeRow
              key={row.folder.id}
              depth={row.depth}
              expanded={row.expanded}
              hasChildren={row.hasChildren}
              label={getFolderLabel(row.folder)}
              noteCount={row.noteCount}
              selected={selectedFolderId === row.folder.folderId}
              viewStyle={treeViewStyle}
              onOpenMenu={
                canEdit ? () => onFolderActions(row.folder) : undefined
              }
              onPress={() =>
                onToggleFolder(row.folder.folderId, row.hasChildren)
              }
            />
          ) : (
            <NoteRow
              key={row.note.id}
              canEdit={canEdit}
              depth={row.depth}
              note={row.note}
              selected={selectedNoteId === row.note.noteId}
              viewStyle={treeViewStyle}
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

function SidebarEmpty({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <YStack padding="$l" gap="$m" alignItems="flex-start">
      <Text size="$label/m" color="$tertiaryText" letterSpacing={0}>
        {title}
      </Text>
      {action}
    </YStack>
  );
}

function NotesTreeSearchInput({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
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
