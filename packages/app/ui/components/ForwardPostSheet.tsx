import { forwardPost } from '@tloncorp/shared';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handleItemSelected = useCallback((item: db.Chat) => {
    if (item.type === 'channel') {
      chatListRef.current?.selectChat(item);
      setSelectedChannel(item.channel);
    }
  }, []);
  const showToast = useToast();
  const handleSendItem = useCallback(async () => {
    if (post && selectedChannel) {
      setIsSending(true);
      setErrorMessage(null);
      try {
        await forwardPost({ postId: post.id, channelId: selectedChannel.id });
        setIsOpen(false);
        showToast({
          message: `Forwarded post to ${selectedChannelTitle}`,
          duration: 1500,
        });
      } catch (error) {
        setErrorMessage('Failed to forward post');
        setTimeout(() => setErrorMessage(null), 1500);
      } finally {
        setIsSending(false);
      }
    }
  }, [post, selectedChannel, selectedChannelTitle, showToast]);

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

  const renderFooter = useCallback(() => {
    if (!selectedChannel) {
      return null;
    }
    return (
      <YStack
        paddingBottom={insets.bottom + getTokenValue('$xl', 'size')}
        paddingHorizontal="$xl"
      >
        <Button
          fill="solid"
          type="primary"
          onPress={handleSendItem}
          disabled={isSending || !!errorMessage}
          label={isSending
            ? 'Forwarding...'
            : errorMessage
              ? errorMessage
              : `Forward to ${selectedChannelTitle}`}
          centered
        />
      </YStack>
    );
  }, [
    handleSendItem,
    insets.bottom,
    isSending,
    errorMessage,
    selectedChannelTitle,
    selectedChannel,
  ]);

  const contextValue = useMemo(() => ({ open: handleOpen }), [handleOpen]);
  return (
    <ForwardPostSheetContext.Provider value={contextValue}>
      {children}
      <ActionSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        snapPointsMode="fit"
        footerComponent={renderFooter}
      >
        <ActionSheet.Content flex={1} paddingBottom="$s">
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
        </ActionSheet.Content>
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
