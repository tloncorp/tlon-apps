import type { NotesNote } from '@tloncorp/api';
import { useState } from 'react';

import { View, YStack } from '../ui';
import { NotesSearchResults } from '../ui/components/NotesChannel/NotesSearchResults';
import { FixtureWrapper } from './FixtureWrapper';

const now = Date.now();

function makeNote(noteId: number, title: string, bodyMd: string): NotesNote {
  return {
    id: `~zod/search-fixture/note/${noteId}`,
    notebookFlag: '~zod/search-fixture',
    noteId,
    notebookId: 100,
    folderId: noteId % 3 === 0 ? 2 : 1,
    title,
    bodyMd,
    updatedAt: now - noteId * 60_000,
    createdAt: now - noteId * 120_000,
  };
}

// Enough hits to overflow the card, so the list has to scroll rather than
// spilling past it.
const notes = Array.from({ length: 24 }, (_, index) =>
  makeNote(
    index + 1,
    index % 4 === 0 ? `Blob spec ${index + 1}` : `Note ${index + 1}`,
    `Paragraph about the post blob wire format. ${'Filler prose to give the snippet something to window over. '.repeat(
      2
    )}The blob entry appears here, mid sentence, so the match is windowed.`
  )
);

const search = {
  loading: false,
  errored: false,
  hasMore: false,
  loadMore: () => {},
  searchComplete: true,
};

// The modal's card geometry — a capped height with the list as the only
// scrollable region — reproduced without the notebook shell or a live ship.
function CappedCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      alignItems="center"
      justifyContent="center"
      flex={1}
      backgroundColor="$secondaryBackground"
    >
      <YStack
        backgroundColor="$background"
        borderColor="$activeBorder"
        borderRadius="$l"
        borderWidth="$2xs"
        gap="$l"
        maxHeight="70%"
        maxWidth={640}
        overflow="hidden"
        padding="$l"
        width="90%"
      >
        <YStack flex={1} minHeight={0}>
          {children}
        </YStack>
      </YStack>
    </View>
  );
}

export default {
  'results in a capped card': (
    <FixtureWrapper fillWidth fillHeight>
      <CappedCard>
        <NotesSearchResults
          notes={notes}
          query="blob"
          search={search}
          selectedNoteId={notes[0].noteId}
          onPressNote={() => {}}
        />
      </CappedCard>
    </FixtureWrapper>
  ),
  'keyboard selection follows the list': (
    <FixtureWrapper fillWidth fillHeight>
      <SelectableResults />
    </FixtureWrapper>
  ),
  'no matches': (
    <FixtureWrapper fillWidth fillHeight>
      <CappedCard>
        <NotesSearchResults
          notes={[]}
          query="nothing here"
          search={search}
          onPressNote={() => {}}
        />
      </CappedCard>
    </FixtureWrapper>
  ),
  'still searching': (
    <FixtureWrapper fillWidth fillHeight>
      <CappedCard>
        <NotesSearchResults
          notes={[]}
          query="blob"
          search={{ ...search, loading: true, searchComplete: false }}
          onPressNote={() => {}}
        />
      </CappedCard>
    </FixtureWrapper>
  ),
};

function SelectableResults() {
  const [selectedNoteId, setSelectedNoteId] = useState(notes[0].noteId);
  return (
    <CappedCard>
      <NotesSearchResults
        notes={notes}
        query="blob"
        search={search}
        selectedNoteId={selectedNoteId}
        onPressNote={(note) => setSelectedNoteId(note.noteId)}
      />
    </CappedCard>
  );
}
