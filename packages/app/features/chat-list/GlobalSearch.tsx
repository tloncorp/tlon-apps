import type { MessageSearchHit } from '@tloncorp/api/client/messageSearch';
import * as store from '@tloncorp/shared/store';
import {
  MessageSearchResults,
  type MessageSearchResultsRef,
} from './MessageSearchResults';
import { Pressable, Text } from '@tloncorp/ui';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInputKeyPressEvent } from 'react-native';

import {
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
  navigateToPost: (post: db.Post, selectedPostId?: string) => void;
  navigateToChannel: (channel: db.Channel, selectedPostId?: string) => void;
}

export function GlobalSearch({
  navigateToGroup,
  navigateToChannel,
  navigateToPost,
}: GlobalSearchProps) {
  const { isOpen, setIsOpen } = useGlobalSearch();
  const supportsMessageSearch = store.useMessageSearchSupported();
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'chats' | 'messages'>(
    supportsMessageSearch ? 'messages' : 'chats'
  );
  const [openingError, setOpeningError] = useState('');
  const opening = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    opening.current = false;
  }, [isOpen]);
  const messageRef = useRef<MessageSearchResultsRef>(null);
  const onSelectMessage = useCallback(
    async (hit: MessageSearchHit) => {
      if (opening.current || !isOpen) return;
      opening.current = true;
      const current = generation.current;
      setOpeningError('');
      try {
        const result = await store.prepareMessageSearchResult(hit);
        if (current !== generation.current) return;
        setIsOpen(false);
        if (result.parent) navigateToPost(result.parent, result.selectedPostId);
        else navigateToChannel(result.channel, result.selectedPostId);
      } catch {
        if (current === generation.current) {
          opening.current = false;
          setOpeningError('Couldn’t open that message. Try again.');
        }
      }
    },
    [setIsOpen, navigateToPost, navigateToChannel, isOpen]
  );
  const inputRef = useRef<TextInputRef>(null);
  const listRef = useRef<FilteredChatListRef>(null);

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

  const handleNavigationKey = useCallback(
    (key: string) => {
      switch (key) {
        case 'ArrowDown':
          if (mode === 'messages') messageRef.current?.selectNext();
          else listRef.current?.selectNext();
          break;
        case 'ArrowUp':
          if (mode === 'messages') messageRef.current?.selectPrevious();
          else listRef.current?.selectPrevious();
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Enter':
          if (mode === 'messages') messageRef.current?.pressSelected();
          else listRef.current?.pressSelected();
          break;
      }
    },
    [setIsOpen, mode]
  );

  const handleKeyPress = useCallback(
    (e: TextInputKeyPressEvent) => {
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
      } else if (
        isOpen &&
        (event.target as HTMLElement | null)?.tagName !== 'SELECT'
      ) {
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
      setOpeningError('');
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
          placeholder={`${supportsMessageSearch ? 'Search your messages or chats' : 'Navigate to workspaces, DMs, or channels'} (${
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
        {supportsMessageSearch ? (
          <XStack gap="$l">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'messages' }}
              onPress={() => setMode('messages')}
            >
              <Text
                color={mode === 'messages' ? '$primaryText' : '$secondaryText'}
              >
                Messages
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'chats' }}
              onPress={() => setMode('chats')}
            >
              <Text
                color={mode === 'chats' ? '$primaryText' : '$secondaryText'}
              >
                Chats
              </Text>
            </Pressable>
          </XStack>
        ) : null}
        <YStack gap="$m" style={{ maxHeight: 400, overflowY: 'scroll' }}>
          {isOpen && mode === 'messages' ? (
            <MessageSearchResults
              ref={messageRef}
              query={searchQuery}
              enabled={isOpen}
              onSelect={onSelectMessage}
              error={openingError}
            />
          ) : null}
          {isOpen && mode === 'chats' && (
            <FilteredChatList
              searchQuery={searchQuery}
              ref={listRef}
              onPressItem={onPressItem}
            />
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
