import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  notesNotebookFlagFromChannelId,
  trackEvent,
  useNotesFolders,
  useNotesNotebook,
  useNotesSearch,
  useNotesSearchSupported,
} from '@tloncorp/shared';
import { noteSearchQueryIsCurrent } from '@tloncorp/shared/logic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SearchBar, View, useIsWindowNarrow } from '../../ui';
import {
  type NotesSearchResultNote,
  NotesSearchResults,
} from '../../ui/components/NotesChannel/NotesSearchResults';
import { makeNotesFolderPathLabeler } from '../../ui/components/NotesChannel/notesTree';

type Props = NativeStackScreenProps<RootStackParamList, 'NotesSearch'>;

export function NotesSearchScreen(props: Props) {
  const { channelId, groupId } = props.route.params;
  const notebookFlag = notesNotebookFlagFromChannelId(channelId);
  // The header hides its search button on an older backend, but a deep link or
  // a route restored from a previous session can still land here.
  const searchSupported = useNotesSearchSupported();
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const { notes, loading, errored, hasMore, loadMore, searchComplete } =
    useNotesSearch(notebookFlag, query);
  const isWindowNarrow = useIsWindowNarrow();

  const search = useMemo(
    () => ({ loading, errored, hasMore, loadMore, searchComplete }),
    [loading, errored, hasMore, loadMore, searchComplete]
  );
  const queryIsCurrent = noteSearchQueryIsCurrent(inputValue, query);
  const visibleSearch = useMemo(
    () =>
      queryIsCurrent
        ? search
        : {
            ...search,
            loading: true,
            errored: false,
            hasMore: false,
            searchComplete: false,
          },
    [queryIsCurrent, search]
  );

  // Local reads, only for labeling which folder a hit lives in — the search
  // itself is entirely the backend's.
  const { data: folders } = useNotesFolders(notebookFlag);
  const { data: notebook } = useNotesNotebook(notebookFlag);
  const getFolderPath = useMemo(
    () =>
      makeNotesFolderPathLabeler({
        folders: folders ?? [],
        rootFolderId: notebook?.rootFolderId ?? null,
      }),
    [folders, notebook?.rootFolderId]
  );

  useEffect(() => {
    trackEvent(AnalyticsEvent.NotesSearchOpened);
  }, [channelId]);

  const handlePressNote = useCallback(
    (note: NotesSearchResultNote) => {
      trackEvent(AnalyticsEvent.NotesSearchResultSelected);
      props.navigation.replace('NotesDetail', {
        channelId,
        groupId,
        noteId: note.noteId,
      });
    },
    [channelId, groupId, props.navigation]
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScreenHeader
        title="Search notes"
        useHorizontalTitleLayout={!isWindowNarrow}
        backAction={props.navigation.goBack}
        borderBottom
      />
      {searchSupported ? (
        <View paddingTop="$2xl" flex={1} minHeight={0}>
          <XStack marginHorizontal="$m">
            <SearchBar
              onChangeQuery={setQuery}
              onChangeValue={setInputValue}
              placeholder="Search notes"
              inputProps={{ autoFocus: true }}
              onPressCancel={() => props.navigation.pop()}
            />
          </XStack>
          <NotesSearchResults
            getFolderPath={getFolderPath}
            notes={queryIsCurrent ? notes : []}
            query={inputValue.trim()}
            search={visibleSearch}
            onPressNote={handlePressNote}
          />
        </View>
      ) : (
        <View paddingHorizontal="$2xl" paddingTop="$3xl">
          <SizableText size="$s" color="$secondaryText" textAlign="center">
            Searching notebooks needs a newer version of the Tlon backend on
            your ship.
          </SizableText>
        </View>
      )}
    </YStack>
  );
}
