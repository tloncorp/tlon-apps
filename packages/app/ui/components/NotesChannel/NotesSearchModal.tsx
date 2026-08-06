import { useNotesSearch } from '@tloncorp/shared';
import { Pressable, TlonText } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { Portal, View, XStack, YStack } from 'tamagui';

import { SearchBar } from '../SearchBar';
import {
  type NotesSearchResultNote,
  NotesSearchResults,
} from './NotesSearchResults';

const isMacPlatform =
  typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');

/**
 * Desktop notebook search: a quick-jump-style overlay masking the whole app, so
 * the tree and the open note stay put behind it. Web-only by construction —
 * narrow layouts navigate to the search screen instead.
 */
export function NotesSearchModal({
  getFolderLabel,
  notebookFlag,
  onOpenChange,
  onSelectNote,
  open,
}: {
  getFolderLabel?: (note: NotesSearchResultNote) => string | null;
  notebookFlag: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  onSelectNote: (note: NotesSearchResultNote) => void;
  open: boolean;
}) {
  // `query` is the debounced value SearchBar hands us, so it is also what the
  // results and the no-match message describe.
  const [query, setQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);

  const { notes, loading, errored, hasMore, loadMore, searchComplete } =
    useNotesSearch(open ? notebookFlag : null, open ? query : '');

  const search = useMemo(
    () => ({ loading, errored, hasMore, loadMore, searchComplete }),
    [loading, errored, hasMore, loadMore, searchComplete]
  );

  // Closing unmounts the overlay's subtree, so the input remounts empty; this
  // keeps the query that drives the search in step with it.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedNoteId(null);
  }, [open]);

  // Keep the highlight on the first result as pages stream in, and drop it if
  // the note it pointed at is no longer in the list.
  useEffect(() => {
    if (notes.length === 0) {
      setSelectedNoteId(null);
      return;
    }
    setSelectedNoteId((current) =>
      current !== null && notes.some((note) => note.noteId === current)
        ? current
        : notes[0].noteId
    );
  }, [notes]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const selectNote = useCallback(
    (note: NotesSearchResultNote) => {
      onSelectNote(note);
      close();
    },
    [close, onSelectNote]
  );

  const moveSelection = useCallback(
    (delta: number) => {
      if (notes.length === 0) return;
      const currentIndex = notes.findIndex(
        (note) => note.noteId === selectedNoteId
      );
      const nextIndex = Math.min(
        notes.length - 1,
        Math.max(0, (currentIndex === -1 ? 0 : currentIndex) + delta)
      );
      setSelectedNoteId(notes[nextIndex].noteId);
      // Arrowing to the end is the same "give me more" signal as scrolling to
      // it, and the list's own onEndReached can't see keyboard movement.
      if (nextIndex === notes.length - 1 && hasMore && !loading) {
        loadMore();
      }
    },
    [hasMore, loadMore, loading, notes, selectedNoteId]
  );

  const handleNavigationKey = useCallback(
    (key: string) => {
      switch (key) {
        case 'ArrowDown':
          moveSelection(1);
          break;
        case 'ArrowUp':
          moveSelection(-1);
          break;
        case 'Escape':
          close();
          break;
        case 'Enter': {
          const selected = notes.find((note) => note.noteId === selectedNoteId);
          if (selected) {
            selectNote(selected);
          }
          break;
        }
      }
    },
    [close, moveSelection, notes, selectNote, selectedNoteId]
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;
      if (
        key === 'ArrowDown' ||
        key === 'ArrowUp' ||
        key === 'Enter' ||
        key === 'Escape'
      ) {
        e.preventDefault();
        handleNavigationKey(key);
      }
    },
    [handleNavigationKey]
  );

  if (!open) return null;

  // Portalled to the app root: rendered in place it would only cover the
  // notebook's own pane, leaving the sidebar and drawer unmasked beside it.
  return (
    <Portal>
      <View
        alignItems="center"
        bottom={0}
        justifyContent="center"
        left={0}
        position="absolute"
        // Tamagui's Portal wraps its children in a `box-none` view, which
        // compiles to `pointer-events: none` with only direct children handed
        // `auto` back. Claiming it explicitly keeps wheel and drag gestures on
        // the overlay instead of letting them fall through to the page behind.
        pointerEvents="auto"
        right={0}
        top={0}
        zIndex={100}
      >
        <Pressable
          onPress={close}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
          testID="NotesSearchModalScrim"
        />

        <YStack
          borderRadius="$l"
          backgroundColor="$background"
          padding="$l"
          width="90%"
          maxWidth={640}
          maxHeight="70%"
          gap="$l"
          borderWidth="$2xs"
          borderColor="$activeBorder"
          // Clips to the capped height so the results list is what scrolls,
          // rather than the card growing past its own rounded corners.
          overflow="hidden"
          testID="NotesSearchModal"
        >
          <SearchBar
            placeholder="Search notes"
            onChangeQuery={setQuery}
            onPressCancel={close}
            inputProps={{
              autoFocus: true,
              autoCapitalize: 'none',
              onKeyPress: handleKeyPress,
              spellCheck: false,
              testID: 'NotesSearchInput',
            }}
          />

          <YStack flex={1} minHeight={0}>
            <NotesSearchResults
              getFolderLabel={getFolderLabel}
              notes={notes}
              query={query}
              search={search}
              selectedNoteId={selectedNoteId}
              onPressNote={selectNote}
            />
          </YStack>

          <XStack justifyContent="center" gap="$l" paddingTop="$xs">
            <KeyHint keys={['↑↓']} label="to navigate" />
            <KeyHint keys={['enter']} label="to open" />
            <KeyHint
              keys={[isMacPlatform ? '⌘⇧F' : 'Ctrl+Shift+F']}
              label="to toggle"
            />
          </XStack>
        </YStack>
      </View>
    </Portal>
  );
}

function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <XStack gap="$xs" alignItems="center">
      {keys.map((key) => (
        <TlonText.Text key={key} size="$label/s" color="$primaryText">
          {key}
        </TlonText.Text>
      ))}
      <TlonText.Text size="$label/s" color="$secondaryText">
        {label}
      </TlonText.Text>
    </XStack>
  );
}
