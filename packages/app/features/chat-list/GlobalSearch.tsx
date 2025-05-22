import type * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';

import {
  Text,
  TextInput,
  TextInputRef,
  View,
  XStack,
  YStack,
  useGlobalSearch,
} from '../../ui';
import { FilteredChatList, FilteredChatListRef } from './FilteredChatList';

export interface GlobalSearchProps {
  navigateToGroup: (id: string) => void;
  navigateToChannel: (channel: db.Channel) => void;
}

export function GlobalSearch({
  navigateToGroup,
  navigateToChannel,
}: GlobalSearchProps) {
  const { isOpen, setIsOpen } = useGlobalSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<TextInputRef>(null);
  const listRef = useRef<FilteredChatListRef>(null);

  const onPressItem = useCallback(
    async (item: db.Chat) => {
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
            <FilteredChatList
              searchQuery={searchQuery}
              ref={listRef}
              onPressItem={onPressItem}
            />
          )}
          {searchQuery !== '' && (
            <Text color="$gray11" textAlign="center" fontFamily="$body">
              Press enter to select a result
            </Text>
          )}
        </YStack>

        <XStack
          justifyContent="center"
          gap="$m"
          paddingTop="$xs"
          borderTopWidth={1}
          borderColor="$gray3"
        >
          <XStack gap="$xs" alignItems="center">
            <Text color="$primaryText" fontFamily="$body">
              ↑↓
            </Text>
            <Text color="$secondaryText" fontFamily="$body">
              to navigate
            </Text>
          </XStack>
          <XStack gap="$xs" alignItems="center">
            <Text color="$primaryText" fontFamily="$body">
              enter
            </Text>
            <Text color="$secondaryText" fontFamily="$body">
              to select
            </Text>
          </XStack>
          <XStack gap="$xs" alignItems="center">
            <Text color="$primaryText" fontFamily="$body">
              esc
            </Text>
            <Text color="$secondaryText" fontFamily="$body">
              or
            </Text>
            <Text color="$primaryText" fontFamily="$body">
              {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
            </Text>
            <Text color="$secondaryText" fontFamily="$body">
              to close
            </Text>
          </XStack>
        </XStack>
      </YStack>
    </>
  );
}
