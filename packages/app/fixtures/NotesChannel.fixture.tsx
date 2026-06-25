import { queryClient } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useMemo, useState } from 'react';

import {
  ChannelHeader,
  ChannelHeaderItemsProvider,
  XStack,
  YStack,
  useRegisterChannelHeaderLoadingSubtitle,
} from '../ui';
import { NotesNoteDetail } from '../ui/components/NotesChannel/NotesNoteDetail';
import { NotesTreePane } from '../ui/components/NotesChannel/NotesTreePane';
import {
  buildFolderNoteCounts,
  buildNotesTreeRows,
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
  makeFolder(2, 'Projects', 1),
  makeFolder(3, 'Backlog', 2),
  makeFolder(4, 'Archive', 1),
];

const notes = [
  makeNote(1, 1, 'Alpha', 'Root-level note that remains visible.'),
  makeNote(
    2,
    2,
    'Beta',
    'This nested note should stay hidden while Projects is collapsed.'
  ),
  makeNote(
    3,
    3,
    'Gamma',
    'This grandchild note should also stay hidden while Projects is collapsed.'
  ),
  makeNote(
    4,
    4,
    'Release checklist',
    '# Release checklist\n\n- Confirm tree behavior\n- Check editor header\n- Publish when ready'
  ),
];

const fakeChannel = {
  id: `notes/${notebookFlag}`,
  type: 'notes',
  title: 'Field notes',
  description: '',
} as db.Channel;

function makeFolder(
  folderId: number,
  name: string,
  parentFolderId: number | null
) {
  return {
    id: `${notebookFlag}/folder/${folderId}`,
    notebookFlag,
    folderId,
    notebookId: notebook.notebookId,
    name,
    parentFolderId,
    createdAt: now - 120_000,
    updatedAt: now - 60_000,
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
    ['notesFolders', new Set(['notesFolders']), notebookFlag],
    folders
  );
  queryClient.setQueryData(
    ['notesNotes', new Set(['notesNotes']), notebookFlag],
    notes
  );
}

function NotesTreeFixture() {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(
    () => new Set()
  );
  const treeRows = useMemo(
    () =>
      buildNotesTreeRows({
        expandedFolderIds,
        folderNoteCounts: buildFolderNoteCounts(folders, notes),
        folders,
        notes,
        rootFolderId: 1,
      }),
    [expandedFolderIds]
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
            isCreatingFolder={false}
            isCreatingNote={false}
            layout="takeover"
            selectedFolderId={null}
            selectedNoteId={1}
            treeRows={treeRows}
            onCreate={() => {}}
            onCreateFolderInFolder={() => {}}
            onCreateNoteInFolder={() => {}}
            onDeleteFolder={() => {}}
            onDeleteNote={() => {}}
            onMoveFolder={() => {}}
            onMoveNote={() => {}}
            onOpenNote={() => {}}
            onRenameFolder={() => {}}
            onToggleFolder={(folderId, hasChildren) => {
              if (!hasChildren) return;
              setExpandedFolderIds((currentIds) => {
                const nextIds = new Set(currentIds);
                if (nextIds.has(folderId)) {
                  nextIds.delete(folderId);
                } else {
                  nextIds.add(folderId);
                }
                return nextIds;
              });
            }}
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
  seedNotesQueries();

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
          <NotesNoteDetail noteId={4} notebookFlag={notebookFlag} />
          {saving ? <ForceSavingHeaderSlot /> : null}
        </YStack>
      </ChannelHeaderItemsProvider>
    </FixtureWrapper>
  );
}

export default {
  'Collapsed Tree': <NotesTreeFixture />,
  'Editor Header': <NotesEditorFixture />,
  'Saving Header': <NotesEditorFixture saving />,
};
