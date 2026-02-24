import * as db from '@tloncorp/shared/db';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScrollViewProps } from 'react-native';
import { XStack } from 'tamagui';

import {
  FilteredChatList,
  FilteredChatListRef,
} from '../../features/chat-list/FilteredChatList';
import { ActionSheet } from './ActionSheet';
import { SearchBar } from './SearchBar';

type ForwardChannelSelectorProps = {
  isOpen: boolean;
  onChannelSelected: (channel: db.Channel) => void;
};

export function ForwardChannelSelector({
  isOpen,
  onChannelSelected,
}: ForwardChannelSelectorProps) {
  const chatListRef = useRef<FilteredChatListRef>(null);
  const [query, setQuery] = useState('');

  const handleQueryChanged = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const listProps = useMemo(() => {
    return {
      renderScrollComponent: (props: ScrollViewProps) => (
        <ActionSheet.ScrollableContent
          {...(props as ComponentProps<typeof ActionSheet.ScrollableContent>)}
        />
      ),
    };
  }, []);

  const handleItemSelected = useCallback(
    (item: db.Chat) => {
      if (item.type === 'channel') {
        chatListRef.current?.selectChat(item);
        onChannelSelected(item.channel);
      }
    },
    [onChannelSelected]
  );

  return (
    <>
      <XStack paddingHorizontal="$xl">
        <SearchBar
          placeholder="Search channels"
          onChangeQuery={handleQueryChanged}
        ></SearchBar>
      </XStack>

      {isOpen && (
        <FilteredChatList
          ref={chatListRef}
          listType="channels"
          searchQuery={query}
          onPressItem={handleItemSelected}
          listProps={listProps}
        />
      )}
    </>
  );
}
