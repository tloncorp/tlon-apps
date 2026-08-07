import type { NotesNote } from '@tloncorp/api';
import {
  type NoteSnippetSegment,
  buildNoteSnippet,
  buildNoteTitleSegments,
} from '@tloncorp/shared/logic';
import { LoadingSpinner, Pressable, useIsWindowNarrow } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, type ViewStyle } from 'react-native';
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

// minHeight lets the list shrink below its content inside a flex column; flex
// gives it the leftover space to scroll within. overscrollBehavior (web-only,
// hence the cast) keeps a wheel gesture that reaches the list's end from
// chaining onward and scrolling the page behind the modal.
const LIST_STYLE = {
  flex: 1,
  minHeight: 0,
  overscrollBehavior: 'contain',
} as ViewStyle;

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
  folderPath,
  note,
  query,
  selected,
  snippetLines,
  onPress,
}: {
  folderPath?: string | null;
  note: NotesSearchResultNote;
  query: string;
  selected: boolean;
  snippetLines: number;
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
    <Pressable onPress={onPress} testID={`NotesSearchResultRow-${note.noteId}`}>
      <ListItem
        alignItems="stretch"
        backgroundColor={selected ? '$shadow' : 'transparent'}
        borderRadius="$xl"
        gap="$l"
        hoverStyle={{ backgroundColor: '$shadow' }}
        paddingHorizontal="$l"
        paddingVertical="$l"
      >
        <ListItem.SystemIcon icon="ChannelNote" />
        {/* MainContent is a fixed $4xl (48px) tall, which a title plus two
            snippet lines overflows — and views clip, so the second line came
            out sliced through the middle. Narrow rows show one line and fit
            that box; wider rows size to their content instead. */}
        <ListItem.MainContent height={snippetLines > 1 ? 'auto' : undefined}>
          <XStack alignItems="baseline" gap="$s" minWidth={0}>
            <ListItem.Title
              size="$body"
              color="$primaryText"
              flexShrink={1}
              fontWeight="400"
              letterSpacing={0}
              minWidth={0}
            >
              <SegmentedText segments={titleSegments} />
            </ListItem.Title>
            {folderPath ? (
              // Trails the title at lower contrast: it locates the note without
              // competing with it. Capped so a deep path can't crowd out the
              // title, and both truncate rather than wrap.
              <SizableText
                size="$s"
                color="$tertiaryText"
                flexShrink={1}
                maxWidth="50%"
                minWidth={0}
                numberOfLines={1}
              >
                {folderPath}
              </SizableText>
            ) : null}
          </XStack>
          {snippet.segments.length > 0 ? (
            // Middle contrast, between the title and the path/timestamp: the
            // snippet is what you read to judge a hit, so it shouldn't sit at
            // the same weight as the metadata locating it.
            <ListItem.Subtitle
              color="$secondaryText"
              numberOfLines={snippetLines}
            >
              <SegmentedText
                segments={snippet.segments}
                prefix={snippet.elidedStart ? ELLIPSIS : undefined}
                suffix={snippet.elidedEnd ? ELLIPSIS : undefined}
              />
            </ListItem.Subtitle>
          ) : null}
        </ListItem.MainContent>
        {updatedAt ? (
          <ListItem.EndContent>
            <ListItem.Time time={updatedAt} letterSpacing={0} />
          </ListItem.EndContent>
        ) : null}
      </ListItem>
    </Pressable>
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
  getFolderPath,
  notes,
  query,
  search,
  selectedNoteId,
  onPressNote,
}: {
  getFolderPath?: (note: NotesSearchResultNote) => string | null;
  notes: NotesSearchResultNote[];
  query: string;
  search: NotesSearchState;
  selectedNoteId?: number | null;
  onPressNote: (note: NotesSearchResultNote) => void;
}) {
  const listRef = useRef<FlatList<NotesSearchResultNote>>(null);
  const isWindowNarrow = useIsWindowNarrow();
  const snippetLines = isWindowNarrow ? 1 : 2;

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
        folderPath={getFolderPath?.(item)}
        note={item}
        query={query}
        selected={item.noteId === selectedNoteId}
        snippetLines={snippetLines}
        onPress={() => onPressNote(item)}
      />
    ),
    [getFolderPath, onPressNote, query, selectedNoteId, snippetLines]
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
        // Without a bounded height the list grows to its content and its own
        // scroller never engages — inside the modal's capped card that means
        // results spill past the edge with no way to reach them.
        style={LIST_STYLE}
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
