import { forwardPost } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  ComponentProps,
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ScrollViewProps } from 'react-native';
import { XStack } from 'tamagui';

import { FilteredChatList } from '../../features/chat-list/FilteredChatList';
import { ActionSheet } from './ActionSheet';
import { SearchBar } from './SearchBar';

const ForwardPostSheetContext = createContext<{
  open: (post: db.Post) => void;
}>({ open: () => {} });

export const ForwardPostSheetProvider = ({ children }: PropsWithChildren) => {
  const [isOpen, setIsOpen] = useState(false);
  const [post, setPost] = useState<db.Post | null>(null);

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

  const handleItemSelected = useCallback(
    async (item: db.Chat) => {
      if (post) {
        await forwardPost({ postId: post.id, channelId: item.id });
      }
      setIsOpen(false);
    },
    [post]
  );

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
        <ActionSheet.SimpleHeader
          title={'Forward post'}
          subtitle="Choose a channel to send to"
        />
        <XStack paddingHorizontal="$xl">
          <SearchBar
            placeholder="Channel name"
            onChangeQuery={handleQueryChanged}
          ></SearchBar>
        </XStack>

        {isOpen && (
          <FilteredChatList
            listType="channels"
            searchQuery={query}
            onPressItem={handleItemSelected}
            listProps={listProps}
          />
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
