import { forwardPost, usePostDraftCallbacks } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
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
import { XStack, YStack } from 'tamagui';

import {
  FilteredChatList,
  FilteredChatListRef,
} from '../../features/chat-list/FilteredChatList';
import { useChatTitle } from '../utils';
import { ActionSheet } from './ActionSheet';
import { SearchBar } from './SearchBar';

const ForwardPostSheetContext = createContext<{
  open: (post: db.Post) => void;
}>({ open: () => {} });

export const ForwardPostSheetProvider = ({ children }: PropsWithChildren) => {
  const [isOpen, setIsOpen] = useState(false);
  const [post, setPost] = useState<db.Post | null>(null);
  const chatListRef = useRef<FilteredChatListRef>(null);

  const handleOpen = useCallback((post: db.Post) => {
    setIsOpen(true);
    setPost(post);
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
  const handleItemSelected = useCallback((item: db.Chat) => {
    if (item.type === 'channel') {
      chatListRef.current?.selectChat(item);
      setSelectedChannel(item.channel);
    }
  }, []);
  const handleSendItem = useCallback(async () => {
    if (post && selectedChannel) {
      setIsSending(true);
      try {
        await forwardPost({ postId: post.id, channelId: selectedChannel.id });
        setIsOpen(false);
      } finally {
        setIsSending(false);
      }
    }
  }, [post, selectedChannel]);

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
    <ForwardPostSheetContext.Provider value={contextValue}>
      {children}
      <ActionSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        snapPoints={[90]}
        snapPointsMode="percent"
      >
        <ActionSheet.SimpleHeader title={'Forward to channel'} />
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
        {selectedChannel && (
          <YStack padding="$xl" paddingBottom={insets.bottom}>
            <Button hero onPress={handleSendItem} disabled={isSending}>
              <Button.Text>
                {isSending
                  ? `Forwarding...`
                  : `Forward to ${selectedChannelTitle}`}
              </Button.Text>
            </Button>
          </YStack>
        )}
      </ActionSheet>
    </ForwardPostSheetContext.Provider>
  );
};

export const useForwardPostSheet = () => {
  const context = useContext(ForwardPostSheetContext);
  if (!context) {
    throw new Error(
      'useForwardPostSheet must be used within a ForwardPostSheetProvider'
    );
  }
  return context;
};
