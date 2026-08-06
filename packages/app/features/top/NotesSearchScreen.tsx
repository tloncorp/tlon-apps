import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  notesNotebookFlagFromChannelId,
  trackEvent,
  useNotesFolders,
  useNotesNotebook,
  useNotesSearch,
} from '@tloncorp/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SearchBar, View, useIsWindowNarrow } from '../../ui';
import {
  type NotesSearchResultNote,
  NotesSearchResults,
} from '../../ui/components/NotesChannel/NotesSearchResults';
import { makeNotesFolderLabeler } from '../../ui/components/NotesChannel/notesTree';

type Props = NativeStackScreenProps<RootStackParamList, 'NotesSearch'>;

export function NotesSearchScreen(props: Props) {
  const { channelId, groupId } = props.route.params;
  const notebookFlag = notesNotebookFlagFromChannelId(channelId);
  const [query, setQuery] = useState('');
  const { notes, loading, errored, hasMore, loadMore, searchComplete } =
    useNotesSearch(notebookFlag, query);
  const isWindowNarrow = useIsWindowNarrow();

  const search = useMemo(
    () => ({ loading, errored, hasMore, loadMore, searchComplete }),
    [loading, errored, hasMore, loadMore, searchComplete]
  );

  // Local reads, only for labeling which folder a hit lives in — the search
  // itself is entirely the backend's.
  const { data: folders } = useNotesFolders(notebookFlag);
  const { data: notebook } = useNotesNotebook(notebookFlag);
  const getFolderLabel = useMemo(
    () =>
      makeNotesFolderLabeler({
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
      <View paddingTop="$2xl" flex={1} minHeight={0}>
        <XStack marginHorizontal="$m">
          <SearchBar
            onChangeQuery={setQuery}
            placeholder="Search notes"
            inputProps={{ autoFocus: true }}
            onPressCancel={() => props.navigation.pop()}
          />
        </XStack>
        <NotesSearchResults
          getFolderLabel={getFolderLabel}
          notes={notes}
          query={query}
          search={search}
          onPressNote={handlePressNote}
        />
      </View>
    </YStack>
  );
}
