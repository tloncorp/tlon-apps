import { useNotesSearch } from '@tloncorp/shared';
import { Pressable, TlonText } from '@tloncorp/ui';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { Portal, View, XStack, YStack } from 'tamagui';

import { TextInput } from '../Form';
import {
  type NotesSearchResultNote,
  NotesSearchResults,
} from './NotesSearchResults';

const isMacPlatform =
  typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');

const QUERY_DEBOUNCE_MS = 300;

/**
 * Desktop notebook search: a quick-jump-style overlay masking the whole app, so
 * the tree and the open note stay put behind it. Web-only by construction —
 * narrow layouts navigate to the search screen instead.
 */
export function NotesSearchModal({
  getFolderPath,
  notebookFlag,
  onOpenChange,
  onSelectNote,
  open,
}: {
  getFolderPath?: (note: NotesSearchResultNote) => string | null;
  notebookFlag: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  onSelectNote: (note: NotesSearchResultNote) => void;
  open: boolean;
}) {
  // The input's live text and the debounced term driving the search are tracked
  // separately: Enter has to know whether what's on screen has been searched
  // yet, which it can't ask a search field that owns its own value.
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);

  const commitQuery = useMemo(
    () =>
      debounce(setQuery, QUERY_DEBOUNCE_MS, { leading: false, trailing: true }),
    []
  );
  useEffect(() => () => commitQuery.cancel(), [commitQuery]);

  const handleChangeText = useCallback(
    (text: string) => {
      setInputValue(text);
      const next = text.trim();
      if (next === '') {
        // Clearing should empty the results at once rather than after a beat.
        commitQuery.cancel();
        setQuery('');
        return;
      }
      commitQuery(next);
    },
    [commitQuery]
  );

  // What's typed hasn't been searched yet, so `notes` still belongs to the
  // previous term.
  const queryIsStale = inputValue.trim() !== query;

  const { notes, loading, errored, hasMore, loadMore, searchComplete } =
    useNotesSearch(open ? notebookFlag : null, open ? query : '');

  const search = useMemo(
    () => ({ loading, errored, hasMore, loadMore, searchComplete }),
    [loading, errored, hasMore, loadMore, searchComplete]
  );

  // Cleared on close rather than on open: the input remounts empty, and a query
  // still in state at open time would search the previous term for a render —
  // flashing stale results and firing a request for them.
  useEffect(() => {
    if (open) return;
    commitQuery.cancel();
    setInputValue('');
    setQuery('');
    setSelectedNoteId(null);
  }, [commitQuery, open]);

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
          if (queryIsStale) {
            // Mid-debounce the visible results belong to the previous term, so
            // Enter searches what's typed instead of opening a hit from it.
            commitQuery.cancel();
            setQuery(inputValue.trim());
            break;
          }
          const selected = notes.find((note) => note.noteId === selectedNoteId);
          if (selected) {
            selectNote(selected);
          }
          break;
        }
      }
    },
    [
      close,
      commitQuery,
      inputValue,
      moveSelection,
      notes,
      queryIsStale,
      selectNote,
      selectedNoteId,
    ]
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
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            icon="Search"
            onChangeText={handleChangeText}
            onKeyPress={handleKeyPress}
            placeholder="Search notes"
            rightControls={
              <TextInput.InnerButton label="Close" onPress={close} />
            }
            spellCheck={false}
            testID="NotesSearchInput"
            value={inputValue}
          />

          <YStack flex={1} minHeight={0}>
            <NotesSearchResults
              getFolderPath={getFolderPath}
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
