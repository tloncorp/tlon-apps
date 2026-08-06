import type { NotesNote } from '@tloncorp/api';
import {
  type NoteSnippetSegment,
  buildNoteSnippet,
  buildNoteTitleSegments,
} from '@tloncorp/shared/logic';
import { LoadingSpinner } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList } from 'react-native';
import { SizableText, View, XStack, YStack } from 'tamagui';

import { ListItem } from '../ListItem';
import { HighlightedText } from '../PostContent/InlineRenderer';
import { noteTimestampMs } from './notesTree';

/**
 * A search hit as the endpoint returns it, not a synced SQLite row: detail
 * fields the local row type guarantees (body, revision) are optional here.
 */
export type NotesSearchResultNote = NotesNote;

export interface NotesSearchState {
  loading: boolean;
  errored: boolean;
  hasMore: boolean;
  loadMore: () => void;
  searchComplete: boolean;
}

const ELLIPSIS = '…';

function SegmentedText({
  segments,
  prefix,
  suffix,
}: {
  segments: NoteSnippetSegment[];
  prefix?: string;
  suffix?: string;
}) {
  return (
    <>
      {prefix}
      {segments.map((segment, index) =>
        segment.match ? (
          <HighlightedText key={index}>{segment.text}</HighlightedText>
        ) : (
          segment.text
        )
      )}
      {suffix}
    </>
  );
}

function NotesSearchResultRowComponent({
  folderLabel,
  note,
  query,
  selected,
  onPress,
}: {
  folderLabel?: string | null;
  note: NotesSearchResultNote;
  query: string;
  selected: boolean;
  onPress: () => void;
}) {
  const titleSegments = useMemo(
    () => buildNoteTitleSegments(note.title || 'Untitled', query),
    [note.title, query]
  );
  const snippet = useMemo(
    () => buildNoteSnippet(note.bodyMd, query),
    [note.bodyMd, query]
  );
  const updatedAt = noteTimestampMs(note.updatedAt ?? note.createdAt);

  return (
    <ListItem
      alignItems="stretch"
      backgroundColor={selected ? '$shadow' : 'transparent'}
      borderRadius="$xl"
      gap="$l"
      paddingHorizontal="$l"
      paddingVertical="$l"
      pressStyle={{ backgroundColor: '$shadow' }}
      onPress={onPress}
      testID={`NotesSearchResultRow-${note.noteId}`}
    >
      <ListItem.SystemIcon icon="ChannelNote" />
      <ListItem.MainContent>
        <ListItem.Title
          size="$body"
          color="$primaryText"
          fontWeight="400"
          letterSpacing={0}
        >
          <SegmentedText segments={titleSegments} />
        </ListItem.Title>
        {snippet.segments.length > 0 ? (
          <ListItem.Subtitle numberOfLines={2}>
            <SegmentedText
              segments={snippet.segments}
              prefix={snippet.elidedStart ? ELLIPSIS : undefined}
              suffix={snippet.elidedEnd ? ELLIPSIS : undefined}
            />
          </ListItem.Subtitle>
        ) : null}
      </ListItem.MainContent>
      <ListItem.EndContent>
        <XStack alignItems="center" gap="$xs">
          {folderLabel ? (
            <SizableText size="$s" color="$tertiaryText" numberOfLines={1}>
              {folderLabel}
            </SizableText>
          ) : null}
          {updatedAt ? (
            <ListItem.Time time={updatedAt} letterSpacing={0} />
          ) : null}
        </XStack>
      </ListItem.EndContent>
    </ListItem>
  );
}

const NotesSearchResultRow = React.memo(NotesSearchResultRowComponent);

export function NotesSearchStatus({
  numResults,
  search,
}: {
  numResults: number;
  search: NotesSearchState;
}) {
  if (search.errored) {
    return (
      <SizableText size="$s" color="$negativeActionText">
        Error searching
      </SizableText>
    );
  }

  return (
    <XStack alignItems="center" justifyContent="center" gap="$s">
      {!search.searchComplete ? <LoadingSpinner size="small" /> : null}
      <SizableText size="$s" color="$secondaryText">
        {numResults > 0 ? `${numResults} results  ·  ` : ''}
        {search.searchComplete ? 'Searched all notes' : 'Searching…'}
      </SizableText>
    </XStack>
  );
}

/**
 * Result list for a notebook search, shared by the desktop modal and the
 * mobile search screen. Selection is owned by the caller so the modal can drive
 * it from the keyboard; this only renders it and keeps it scrolled into view.
 */
export function NotesSearchResults({
  getFolderLabel,
  notes,
  query,
  search,
  selectedNoteId,
  onPressNote,
}: {
  getFolderLabel?: (note: NotesSearchResultNote) => string | null;
  notes: NotesSearchResultNote[];
  query: string;
  search: NotesSearchState;
  selectedNoteId?: number | null;
  onPressNote: (note: NotesSearchResultNote) => void;
}) {
  const listRef = useRef<FlatList<NotesSearchResultNote>>(null);

  const selectedIndex = useMemo(
    () =>
      selectedNoteId == null
        ? -1
        : notes.findIndex((note) => note.noteId === selectedNoteId),
    [notes, selectedNoteId]
  );

  useEffect(() => {
    if (selectedIndex < 0) return;
    listRef.current?.scrollToIndex({ index: selectedIndex, viewPosition: 0.5 });
  }, [selectedIndex]);

  const handleEndReached = useCallback(() => {
    if (!search.loading && search.hasMore) {
      search.loadMore();
    }
  }, [search]);

  const renderItem = useCallback(
    ({ item }: { item: NotesSearchResultNote }) => (
      <NotesSearchResultRow
        folderLabel={getFolderLabel?.(item)}
        note={item}
        query={query}
        selected={item.noteId === selectedNoteId}
        onPress={() => onPressNote(item)}
      />
    ),
    [getFolderLabel, onPressNote, query, selectedNoteId]
  );

  const keyExtractor = useCallback(
    (note: NotesSearchResultNote) => note.id,
    []
  );

  if (query === '') {
    return (
      <NotesSearchMessage text="Search this notebook by note title or content." />
    );
  }

  if (notes.length === 0) {
    return search.searchComplete ? (
      <NotesSearchMessage text={`No notes match “${query}”.`} />
    ) : (
      <YStack alignItems="center" paddingVertical="$3xl">
        <NotesSearchStatus numResults={0} search={search} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} minHeight={0} gap="$s">
      <FlatList
        ref={listRef}
        data={notes}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // Rows vary in height with their snippet, so an off-viewport
        // scrollToIndex has no measurement to work from until it renders.
        onScrollToIndexFailed={() => {}}
        testID="NotesSearchResultsList"
      />
      <View paddingVertical="$s">
        <NotesSearchStatus numResults={notes.length} search={search} />
      </View>
    </YStack>
  );
}

function NotesSearchMessage({ text }: { text: string }) {
  return (
    <YStack
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$2xl"
      paddingVertical="$3xl"
    >
      <SizableText size="$s" color="$secondaryText" textAlign="center">
        {text}
      </SizableText>
    </YStack>
  );
}
