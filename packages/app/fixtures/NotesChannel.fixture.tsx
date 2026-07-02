import { queryClient } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect, useMemo, useState } from 'react';
import { useSelect } from 'react-cosmos/client';

import {
  ChannelHeader,
  ChannelHeaderItemsProvider,
  XStack,
  YStack,
  useRegisterChannelHeaderItem,
  useRegisterChannelHeaderLoadingSubtitle,
} from '../ui';
import { NotesHeaderActions } from '../ui/components/NotesChannel/NotesHeaderActions';
import { NotesNoteDetail } from '../ui/components/NotesChannel/NotesNoteDetail';
import { NotesTreePane } from '../ui/components/NotesChannel/NotesTreePane';
import {
  buildFolderContentsRows,
  buildFolderNoteCounts,
} from '../ui/components/NotesChannel/notesTree';
import { FixtureWrapper } from './FixtureWrapper';

const notebookFlag = '~zod/native-notes-fixture';
const now = Date.now();

const notebook = {
  id: notebookFlag,
  host: '~zod',
  flagName: 'native-notes-fixture',
  notebookId: 100,
  title: 'Field notes',
  visibility: 'private',
  rootFolderId: 1,
  currentUserRole: 'editor',
  createdAt: now - 90_000,
  updatedAt: now,
} as db.NotesNotebook;

const folders = [
  makeFolder(1, '/', null),
  makeFolder(2, 'Projects', 1, 90_000),
  makeFolder(3, 'Backlog', 2, 80_000),
  makeFolder(4, 'Archive', 1, 70_000),
  makeFolder(5, 'Research', 2, 60_000),
  makeFolder(6, 'Personal', 1, 50_000),
];

const notes = [
  makeNote(
    1,
    1,
    'Inbox capture',
    'Root-level note that remains visible in the main notebook list.'
  ),
  makeNote(
    2,
    2,
    'Roadmap sketch for native notebooks',
    'This nested note appears when the Projects folder screen is open.'
  ),
  makeNote(
    3,
    3,
    'Loose backlog ideas',
    'This grandchild note appears when the Backlog folder screen is open.'
  ),
  makeNote(
    4,
    4,
    'Release checklist',
    '# Release checklist\n\n- Confirm tree behavior\n- Check editor header\n- Publish when ready'
  ),
  makeNote(
    5,
    5,
    'Long title: portable markdown tables, import progress, and row overflow behavior',
    '| Area | Status |\n| --- | --- |\n| Import | Testing |\n| Publish | Ready |'
  ),
  makeNote(6, 6, '', 'Untitled note body'),
  makeNote(
    7,
    1,
    'Meeting notes',
    'A second root note so the list has mixed root and nested content.'
  ),
];
const emptyFolders = [folders[0]];
const emptyNotes: db.NotesNote[] = [];

const fakeChannel = {
  id: `notes/${notebookFlag}`,
  type: 'notes',
  title: 'Field notes',
  description: '',
} as db.Channel;

function makeFolder(
  folderId: number,
  name: string,
  parentFolderId: number | null,
  updatedAgoMs = 60_000
) {
  return {
    id: `${notebookFlag}/folder/${folderId}`,
    notebookFlag,
    folderId,
    notebookId: notebook.notebookId,
    name,
    parentFolderId,
    createdAt: now - 120_000,
    updatedAt: now - updatedAgoMs,
  } as db.NotesFolder;
}

function makeNote(
  noteId: number,
  folderId: number,
  title: string,
  body: string
) {
  return {
    id: `${notebookFlag}/note/${noteId}`,
    notebookFlag,
    noteId,
    notebookId: notebook.notebookId,
    folderId,
    title,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    bodyMd: body,
    createdAt: now - noteId * 80_000,
    updatedAt: now - noteId * 20_000,
    revision: 4,
  } as db.NotesNote;
}

function seedNotesQueries() {
  queryClient.setQueryData(['notesEnsureJoined', notebookFlag], true);
  queryClient.setQueryData(['notesSync', notebookFlag], {
    notebook,
    folders,
    notes,
    members: [],
  });
  queryClient.setQueryData(
    ['notesNotebook', new Set(['notesNotebooks']), notebookFlag],
    notebook
  );
  queryClient.setQueryData(
    [
      'notesNotebookWithRelations',
      new Set(['notesNotebooks', 'notesFolders', 'notesNotes', 'notesMembers']),
      notebookFlag,
    ],
    { ...notebook, folders, notes, members: [] }
  );
  queryClient.setQueryData(
    ['notesFolders', new Set(['notesFolders']), notebookFlag],
    folders
  );
  queryClient.setQueryData(
    ['notesNotes', new Set(['notesNotes']), notebookFlag],
    notes
  );
}

function useSeedNotesFixtureData() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    seedNotesQueries();
    db.saveNotesNotebookSnapshot({
      notebook,
      folders,
      notes,
      members: [],
    })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          seedNotesQueries();
          setReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return ready;
}

type ContentsState = 'Populated' | 'Empty' | 'Read only';
type ContentsViewport = 'Phone channel' | 'Desktop sidebar';
type SelectedItem =
  | 'Inbox capture'
  | 'Projects folder'
  | 'Release checklist'
  | 'No selection';

function NotebookContentsListFixture() {
  const [contentsState] = useSelect<ContentsState>('Contents', {
    defaultValue: 'Populated',
    options: ['Populated', 'Empty', 'Read only'],
  });
  const [viewport] = useSelect<ContentsViewport>('Viewport', {
    defaultValue: 'Phone channel',
    options: ['Phone channel', 'Desktop sidebar'],
  });
  const [selectedItem] = useSelect<SelectedItem>('Selected item', {
    defaultValue: 'Inbox capture',
    options: [
      'Inbox capture',
      'Projects folder',
      'Release checklist',
      'No selection',
    ],
  });

  const fixtureFolders = contentsState === 'Empty' ? emptyFolders : folders;
  const fixtureNotes = contentsState === 'Empty' ? emptyNotes : notes;
  const canEdit = contentsState !== 'Read only';
  const usePhoneViewport = viewport === 'Phone channel';
  const initialSelection = useMemo(() => {
    if (contentsState === 'Empty' || selectedItem === 'No selection') {
      return { activeFolderId: 1, noteId: null };
    }

    if (selectedItem === 'Projects folder') {
      return { activeFolderId: 1, noteId: null };
    }

    if (selectedItem === 'Release checklist') {
      return { activeFolderId: 4, noteId: 4 };
    }

    return { activeFolderId: 1, noteId: 1 };
  }, [contentsState, selectedItem]);
  const [activeFolderId, setActiveFolderId] = useState<number>(
    initialSelection.activeFolderId
  );
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(
    initialSelection.noteId
  );

  useEffect(() => {
    setActiveFolderId(initialSelection.activeFolderId);
    setSelectedNoteId(initialSelection.noteId);
  }, [initialSelection]);

  const treeRows = useMemo(
    () =>
      buildFolderContentsRows({
        folderId: activeFolderId,
        folderNoteCounts: buildFolderNoteCounts(fixtureFolders, fixtureNotes),
        folders: fixtureFolders,
        notes: fixtureNotes,
        rootFolderId: 1,
      }),
    [activeFolderId, fixtureFolders, fixtureNotes]
  );

  const openFolder = (folder: db.NotesFolder) => {
    setSelectedNoteId(null);
    setActiveFolderId(folder.folderId);
  };

  const openNote = (note: db.NotesNote) => {
    setSelectedNoteId(note.noteId);
  };

  return (
    <FixtureWrapper fillWidth fillHeight backgroundColor="$secondaryBackground">
      <ChannelHeaderItemsProvider>
        <YStack
          flex={1}
          width={usePhoneViewport ? 390 : 360}
          maxWidth="100%"
          height="100%"
          backgroundColor="$background"
          borderLeftWidth={usePhoneViewport ? 0 : 1}
          borderRightWidth={usePhoneViewport ? 0 : 1}
          borderColor="$border"
        >
          {usePhoneViewport ? (
            <>
              <FixtureNotesHeaderActions canEdit={canEdit} />
              <ChannelHeader
                channel={fakeChannel}
                description=""
                goBack={() => {}}
                hideIdentity
                title="Field notes"
              />
            </>
          ) : null}
          <NotesTreePane
            canEdit={canEdit}
            isDeletingFolder={false}
            layout={usePhoneViewport ? 'stack' : 'takeover'}
            selectedNoteId={selectedNoteId}
            treeRows={treeRows}
            onCreateFolderInFolder={() => {}}
            onCreateNoteInFolder={() => {}}
            onDeleteFolder={() => {}}
            onDeleteNote={() => {}}
            onMoveFolder={() => {}}
            onMoveNote={() => {}}
            onOpenNote={openNote}
            onOpenFolder={openFolder}
            onRenameFolder={() => {}}
            onRenameNote={() => {}}
          />
        </YStack>
      </ChannelHeaderItemsProvider>
    </FixtureWrapper>
  );
}

function FixtureNotesHeaderActions({ canEdit }: { canEdit: boolean }) {
  const headerActions = useMemo(
    () => (
      <NotesHeaderActions
        canEdit={canEdit}
        onNew={() => {}}
        primaryActionVariant="text"
      />
    ),
    [canEdit]
  );
  useRegisterChannelHeaderItem(headerActions);
  return null;
}

function NotesTreeFixture() {
  const [activeFolderId, setActiveFolderId] = useState<number>(1);
  const treeRows = useMemo(
    () =>
      buildFolderContentsRows({
        folderId: activeFolderId,
        folderNoteCounts: buildFolderNoteCounts(folders, notes),
        folders,
        notes,
        rootFolderId: 1,
      }),
    [activeFolderId]
  );

  return (
    <FixtureWrapper fillWidth fillHeight backgroundColor="$secondaryBackground">
      <XStack flex={1} width="100%" height="100%">
        <YStack
          width={360}
          borderRightWidth={1}
          borderRightColor="$border"
          backgroundColor="$background"
        >
          <NotesTreePane
            canEdit
            isDeletingFolder={false}
            layout="takeover"
            selectedNoteId={1}
            treeRows={treeRows}
            onCreateFolderInFolder={() => {}}
            onCreateNoteInFolder={() => {}}
            onDeleteFolder={() => {}}
            onDeleteNote={() => {}}
            onMoveFolder={() => {}}
            onMoveNote={() => {}}
            onOpenNote={() => {}}
            onOpenFolder={(folder) => setActiveFolderId(folder.folderId)}
            onRenameFolder={() => {}}
            onRenameNote={() => {}}
          />
        </YStack>
        <YStack flex={1} backgroundColor="$background" />
      </XStack>
    </FixtureWrapper>
  );
}

function ForceSavingHeaderSlot() {
  useRegisterChannelHeaderLoadingSubtitle('Saving...');
  return null;
}

function NotesEditorFixture({ saving = false }: { saving?: boolean }) {
  const ready = useSeedNotesFixtureData();

  return (
    <FixtureWrapper fillWidth fillHeight backgroundColor="$background">
      <ChannelHeaderItemsProvider>
        <YStack flex={1} width="100%" backgroundColor="$background">
          <ChannelHeader
            channel={fakeChannel}
            description=""
            goBack={() => {}}
            hideIdentity
            title="Field notes"
          />
          {ready ? (
            <NotesNoteDetail
              noteId={4}
              notebookFlag={notebookFlag}
              syncEnabled={false}
            />
          ) : null}
          {saving ? <ForceSavingHeaderSlot /> : null}
        </YStack>
      </ChannelHeaderItemsProvider>
    </FixtureWrapper>
  );
}

export default {
  'Contents List': <NotebookContentsListFixture />,
  'Folder Contents': <NotesTreeFixture />,
  'Editor Header': <NotesEditorFixture />,
  'Saving Header': <NotesEditorFixture saving />,
};
