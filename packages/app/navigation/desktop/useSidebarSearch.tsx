import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { ChatListSearch } from '../../features/chat-list/ChatListSearch';

/**
 * The sidebar's search button. Web opens the Cmd-K global search; native has
 * no global search, so it filters the sidebar list in place like the phone
 * chat list does.
 */
export function useSidebarSearch(openGlobalSearch: () => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const toggle = useCallback(() => {
    if (Platform.OS === 'web') {
      openGlobalSearch();
      return;
    }
    setQuery('');
    setIsOpen((open) => !open);
  }, [openGlobalSearch]);

  const clear = useCallback(() => setQuery(''), []);

  const close = useCallback(() => {
    setQuery('');
    setIsOpen(false);
  }, []);

  const searchInput =
    Platform.OS === 'web' ? null : (
      <ChatListSearch
        query={query}
        onQueryChange={setQuery}
        isOpen={isOpen}
        onPressClear={clear}
        onPressClose={close}
      />
    );

  return { query, toggle, searchInput };
}
