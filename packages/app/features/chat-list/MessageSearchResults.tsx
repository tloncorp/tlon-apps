import type { MessageSearchHit } from '@tloncorp/api/client/messageSearch';
import * as store from '@tloncorp/shared/store';
import { makePrettyShortDate } from '@tloncorp/shared/logic';
import { Pressable, Text } from '@tloncorp/ui';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { XStack, YStack, useTheme } from 'tamagui';

const EMPTY_HITS: MessageSearchHit[] = [];

export interface MessageSearchResultsRef {
  selectNext: () => void;
  selectPrevious: () => void;
  pressSelected: () => void;
}

export const MessageSearchResults = forwardRef<
  MessageSearchResultsRef,
  {
    query: string;
    enabled: boolean;
    onSelect: (hit: MessageSearchHit) => void;
    error?: string;
  }
>(function MessageSearchResults({ query, enabled, onSelect, error }, ref) {
  const [channelId, setChannelId] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [selected, setSelected] = useState(0);
  const search = store.useMessageSearch({
    query,
    channelId: channelId || undefined,
    authorId: authorId || undefined,
    enabled,
  });
  const hits = search.waiting ? EMPTY_HITS : search.hits;
  const theme = useTheme();
  useEffect(() => setSelected(0), [query, channelId, authorId]);
  useEffect(() => {
    if (
      channelId &&
      !search.conversations.some((room) => room.id === channelId)
    )
      setChannelId('');
  }, [channelId, search.conversations]);
  const selectNext = useCallback(
    () =>
      setSelected((index) => Math.min(index + 1, Math.max(0, hits.length - 1))),
    [hits.length]
  );
  const selectPrevious = useCallback(
    () => setSelected((index) => Math.max(index - 1, 0)),
    []
  );
  const pressSelected = useCallback(() => {
    if (hits[selected]) onSelect(hits[selected]);
  }, [hits, selected, onSelect]);
  useImperativeHandle(
    ref,
    () => ({ selectNext, selectPrevious, pressSelected }),
    [selectNext, selectPrevious, pressSelected]
  );
  const { refetch } = search;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);
  return (
    <YStack gap="$m" testID="message-search-results">
      <XStack gap="$m" flexWrap="wrap">
        <label style={{ fontSize: 13, color: theme.secondaryText.val }}>
          Conversation{' '}
          <select
            aria-label="Search conversation"
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            style={{
              maxWidth: 260,
              background: theme.background.val,
              color: theme.primaryText.val,
              borderColor: theme.border.val,
              borderRadius: 6,
              padding: 6,
            }}
          >
            <option value="">All my conversations</option>
            {search.conversations.map((room) => (
              <option key={room.id} value={room.id}>
                {room.title}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: theme.secondaryText.val }}>
          Author{' '}
          <select
            aria-label="Search author"
            value={authorId}
            onChange={(event) => setAuthorId(event.target.value)}
            style={{
              background: theme.background.val,
              color: theme.primaryText.val,
              borderColor: theme.border.val,
              borderRadius: 6,
              padding: 6,
            }}
          >
            <option value="">Anyone</option>
            {search.authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
        </label>
      </XStack>
      {!query.trim() ? (
        <Text color="$secondaryText">
          Search messages in your conversations.
        </Text>
      ) : null}
      {query.trim() && (search.isLoading || search.waiting) ? (
        <Text color="$secondaryText">Searching…</Text>
      ) : null}
      {error ? <Text color="$negativeActionText">{error}</Text> : null}
      {search.isError ? (
        <XStack gap="$m">
          <Text color="$negativeActionText">Search couldn’t finish.</Text>
          <Pressable onPress={retry} accessibilityRole="button">
            <Text>Retry</Text>
          </Pressable>
        </XStack>
      ) : null}
      {query.trim() &&
      !search.waiting &&
      !search.isLoading &&
      !search.isError &&
      hits.length === 0 ? (
        <Text color="$secondaryText">No messages found.</Text>
      ) : null}
      {hits.map((hit, index) => (
        <MessageSearchResult
          key={hit.post.id}
          hit={hit}
          selected={index === selected}
          onSelect={onSelect}
        />
      ))}
      {search.hasNextPage ? (
        <Pressable
          onPress={() => void search.fetchNextPage()}
          disabled={search.isFetchingNextPage}
          accessibilityRole="button"
        >
          <Text>
            {search.isFetchingNextPage ? 'Loading…' : 'Load more messages'}
          </Text>
        </Pressable>
      ) : null}
    </YStack>
  );
});

export function MessageSearchResult({
  hit,
  selected,
  onSelect,
}: {
  hit: MessageSearchHit;
  selected?: boolean;
  onSelect: (hit: MessageSearchHit) => void;
}) {
  const element = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (selected) element.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  const press = useCallback(() => onSelect(hit), [onSelect, hit]);
  return (
    <Pressable
      ref={element}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={`${hit.authorName} in ${hit.conversationTitle}: ${hit.post.textContent}`}
      testID={`message-search-result-${hit.post.id}`}
    >
      <YStack
        padding="$m"
        gap="$xs"
        borderRadius="$m"
        backgroundColor={selected ? '$secondaryBackground' : '$background'}
      >
        <XStack justifyContent="space-between" gap="$m">
          <Text size="$label/s" color="$secondaryText" flexShrink={1}>
            {hit.conversationTitle}
            {hit.post.parentId ? ' · Thread' : ''}
          </Text>
          <Text size="$label/s" color="$secondaryText">
            {makePrettyShortDate(new Date(hit.post.sentAt))}
          </Text>
        </XStack>
        <Text size="$label/m">{hit.authorName}</Text>
        <Text size="$body" numberOfLines={3}>
          {hit.post.textContent}
        </Text>
      </YStack>
    </Pressable>
  );
}
