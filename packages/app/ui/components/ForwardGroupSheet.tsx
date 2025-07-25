import { forwardGroup } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, useToast } from '@tloncorp/ui';
import {
  ComponentProps,
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack, getTokenValue } from 'tamagui';

import {
  FilteredChatList,
  FilteredChatListRef,
} from '../../features/chat-list/FilteredChatList';
import { useChatTitle } from '../utils';
import { ActionSheet } from './ActionSheet';
import { SearchBar } from './SearchBar';

const ForwardGroupSheetContext = createContext<{
  open: (group: db.Group) => void;
}>({ open: () => {} });

export const ForwardGroupSheetProvider = ({ children }: PropsWithChildren) => {
  const [isOpen, setIsOpen] = useState(false);
  const [group, setGroup] = useState<db.Group | null>(null);
  const chatListRef = useRef<FilteredChatListRef>(null);

  const handleOpen = useCallback((group: db.Group) => {
    setIsOpen(true);
    setGroup(group);
  }, []);

  const [query, setQuery] = useState<string>('');
  const handleQueryChanged = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);
  // Clear the query when the action sheet is closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const [selectedChannel, setSelectedChannel] = useState<db.Channel | null>(
    null
  );
  const selectedChannelTitle = useChatTitle(selectedChannel);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handleItemSelected = useCallback((item: db.Chat) => {
    if (item.type === 'channel') {
      chatListRef.current?.selectChat(item);
      setSelectedChannel(item.channel);
    }
  }, []);
  const showToast = useToast();
  const handleSendItem = useCallback(async () => {
    if (group && selectedChannel) {
      setIsSending(true);
      setErrorMessage(null);
      try {
        await forwardGroup({ groupId: group.id, channelId: selectedChannel.id });
        setIsOpen(false);
        showToast({
          message: `Forwarded group to ${selectedChannelTitle}`,
          duration: 1500,
        });
      } catch (error) {
        setErrorMessage('Failed to forward group');
        setTimeout(() => setErrorMessage(null), 1500);
      } finally {
        setIsSending(false);
      }
    }
  }, [group, selectedChannel, selectedChannelTitle, showToast]);

  const insets = useSafeAreaInsets();

  const listProps = useMemo(() => {
    return {
      renderScrollComponent: (props: ScrollViewProps) => (
        <ActionSheet.ScrollableContent
          {...(props as ComponentProps<typeof ActionSheet.ScrollableContent>)}
        />
      ),
    };
  }, []);

  const contextValue = useMemo(() => ({ open: handleOpen }), [handleOpen]);
  return (
    <ForwardGroupSheetContext.Provider value={contextValue}>
      {children}
      <ActionSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        snapPoints={[90]}
        snapPointsMode="percent"
      >
        <ActionSheet.SimpleHeader title={'Forward group'} />
        <XStack paddingHorizontal="$xl">
          <SearchBar
            placeholder="Search channels"
            onChangeQuery={handleQueryChanged}
          ></SearchBar>
        </XStack>

        <FilteredChatList
          ref={chatListRef}
          listType="channels"
          searchQuery={query}
          onPressItem={handleItemSelected}
          listProps={listProps}
        />
        {selectedChannel && (
          <YStack
            padding="$xl"
            paddingBottom={insets.bottom + getTokenValue('$xl', 'size')}
          >
            <Button
              hero
              onPress={handleSendItem}
              disabled={isSending || !!errorMessage}
            >
              <Button.Text>
                {isSending
                  ? `Forwarding...`
                  : errorMessage
                    ? errorMessage
                    : `Forward to ${selectedChannelTitle}`}
              </Button.Text>
            </Button>
          </YStack>
        )}
      </ActionSheet>
    </ForwardGroupSheetContext.Provider>
  );
};

export function useForwardGroupSheet() {
  return useContext(ForwardGroupSheetContext);
}