import * as api from '@tloncorp/api';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';

import {
  Pressable,
  SectionListHeader,
  TextInput,
  TextInputRef,
  TlonText,
  View,
  XStack,
  YStack,
  useGlobalSearch,
} from '../../ui';
import { FilteredChatList, FilteredChatListRef } from './FilteredChatList';

export interface GlobalSearchProps {
  navigateToGroup: (id: string) => void;
  navigateToChannel: (channel: db.Channel, selectedPostId?: string) => void;
}

export function GlobalSearch({
  navigateToGroup,
  navigateToChannel,
}: GlobalSearchProps) {
  const { isOpen, setIsOpen } = useGlobalSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<TextInputRef>(null);
  const listRef = useRef<FilteredChatListRef>(null);
  const { data: channels } = store.useAllChannels({ enabled: isOpen });
  const channelsById = useMemo(
    () => new Map((channels ?? []).map((channel) => [channel.id, channel])),
    [channels]
  );

  const onPressItem = useCallback(
    async (item: db.Chat) => {
      trackEvent(AnalyticsEvent.GlobalSearchResultSelected, {
        type: item.type === 'group' ? 'group' : item.channel.type,
      });
      if (item.type === 'group') {
        navigateToGroup(item.group.id);
      } else {
        navigateToChannel(item.channel);
      }
      setIsOpen(false);
    },
    [navigateToGroup, navigateToChannel, setIsOpen]
  );

  const onPressMessage = useCallback(
    (hit: api.GlobalSearchHit) => {
      const channelId = api.globalSearchChannelId(hit.ref.source);
      const channel = channelsById.get(channelId);
      if (!channel) return;
      navigateToChannel(channel, hit.ref.reply ?? hit.ref.top);
      setIsOpen(false);
    },
    [channelsById, navigateToChannel, setIsOpen]
  );

  const handleNavigationKey = useCallback(
    (key: string) => {
      switch (key) {
        case 'ArrowDown':
          listRef.current?.selectNext();
          break;
        case 'ArrowUp':
          listRef.current?.selectPrevious();
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Enter':
          listRef.current?.pressSelected();
          break;
      }
    },
    [setIsOpen]
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;
      const metaKey = (e.nativeEvent as any).metaKey;
      const ctrlKey = (e.nativeEvent as any).ctrlKey;

      if ((metaKey || ctrlKey) && key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(false);
      } else if (
        key === 'ArrowDown' ||
        key === 'ArrowUp' ||
        key === 'Enter' ||
        key === 'Escape'
      ) {
        e.preventDefault();
        handleNavigationKey(key);
      }
    },
    [handleNavigationKey, setIsOpen]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(!isOpen);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      } else if (isOpen) {
        // Handle navigation keys
        switch (event.key) {
          case 'ArrowDown':
          case 'ArrowUp':
          case 'Enter':
            event.preventDefault();
            handleNavigationKey(event.key);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNavigationKey, setIsOpen]);

  useEffect(() => {
    if (isOpen) {
      trackEvent(AnalyticsEvent.GlobalSearchOpened);
      inputRef.current?.focus();
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <View
        // eslint-disable-next-line
        onPress={() => {
          setIsOpen(false);
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 50,
        }}
      />

      <YStack
        position="absolute"
        top="20%"
        left="50%"
        borderRadius="$l"
        zIndex={51}
        backgroundColor="$background"
        transform="translateX(-50%)"
        padding="$l"
        width="90%"
        maxWidth={600}
        gap="$l"
        borderWidth="$2xs"
        borderColor={'$activeBorder'}
      >
        <TextInput
          ref={inputRef}
          placeholder={`Navigate to groups, DMs, or channels (${
            navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'
          })`}
          icon="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onKeyPress={handleKeyPress}
          rightControls={
            <TextInput.InnerButton
              label="Close"
              onPress={() => setIsOpen(false)}
            />
          }
          spellCheck={false}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <YStack gap="$m" style={{ maxHeight: 400, overflowY: 'scroll' }}>
          {isOpen && (
            <>
              <FilteredChatList
                searchQuery={searchQuery}
                ref={listRef}
                onPressItem={onPressItem}
              />
              <GlobalMessageSearchResults
                query={searchQuery}
                channelsById={channelsById}
                onPress={onPressMessage}
              />
            </>
          )}
        </YStack>

        <XStack justifyContent="center" gap="$l" paddingTop="$xs">
          <XStack gap="$xs" alignItems="center">
            <TlonText.Text size="$label/s" color="$primaryText">
              ↑↓
            </TlonText.Text>
            <TlonText.Text size="$label/s" color="$secondaryText">
              to navigate
            </TlonText.Text>
          </XStack>
          <XStack gap="$xs" alignItems="center">
            <TlonText.Text size="$label/s" color="$primaryText">
              enter
            </TlonText.Text>
            <TlonText.Text size="$label/s" color="$secondaryText">
              to select
            </TlonText.Text>
          </XStack>
          <XStack gap="$xs" alignItems="center">
            <TlonText.Text size="$label/s" color="$primaryText">
              esc
            </TlonText.Text>
            <TlonText.Text size="$label/s" color="$secondaryText">
              or
            </TlonText.Text>
            <TlonText.Text size="$label/s" color="$primaryText">
              {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
            </TlonText.Text>
            <TlonText.Text size="$label/s" color="$secondaryText">
              to close
            </TlonText.Text>
          </XStack>
        </XStack>
      </YStack>
    </>
  );
}

function GlobalMessageSearchResults({
  query,
  channelsById,
  onPress,
}: {
  query: string;
  channelsById: Map<string, db.Channel>;
  onPress: (hit: api.GlobalSearchHit) => void;
}) {
  const [page, setPage] = useState<api.GlobalSearchPage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setPage(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .searchGlobally({ query: trimmed })
        .then((result) => {
          if (!cancelled) setPage(result);
        })
        .catch(() => {
          if (!cancelled) setPage(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const loadMore = useCallback(async () => {
    if (!page?.next || loading) return;
    setLoading(true);
    try {
      const next = await api.searchGlobally({
        query: query.trim(),
        cursor: page.next,
      });
      setPage({ ...next, hits: [...page.hits, ...next.hits] });
    } finally {
      setLoading(false);
    }
  }, [loading, page, query]);

  if (!query.trim()) return null;
  if (!page?.hits.length) {
    return loading ? (
      <TlonText.Text size="$label/s" color="$secondaryText" padding="$m">
        Searching messages…
      </TlonText.Text>
    ) : null;
  }

  return (
    <YStack>
      <SectionListHeader>
        <SectionListHeader.Text>Messages</SectionListHeader.Text>
      </SectionListHeader>
      {page.hits.map((hit) => {
        const channelId = api.globalSearchChannelId(hit.ref.source);
        const channel = channelsById.get(channelId);
        return (
          <Pressable
            key={`${channelId}:${hit.ref.top}:${hit.ref.reply ?? ''}`}
            disabled={!channel}
            onPress={() => onPress(hit)}
            paddingHorizontal="$l"
            paddingVertical="$m"
            borderBottomWidth="$2xs"
            borderColor="$border"
            hoverStyle={{ backgroundColor: '$secondaryBackground' }}
          >
            <TlonText.Text size="$label/s" color="$secondaryText">
              {channel?.title ?? channelId} · {hit.author}
            </TlonText.Text>
            <TlonText.Text numberOfLines={2}>{hit.snippet}</TlonText.Text>
          </Pressable>
        );
      })}
      {page.next && (
        <Pressable onPress={loadMore} padding="$m" alignItems="center">
          <TlonText.Text color="$positiveActionText">
            {loading ? 'Loading…' : 'Load more'}
          </TlonText.Text>
        </Pressable>
      )}
    </YStack>
  );
}
