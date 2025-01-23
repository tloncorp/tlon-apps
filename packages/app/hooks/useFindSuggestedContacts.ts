import * as store from '@tloncorp/shared/store';
import { useEffect } from 'react';

export function useFindSuggestedContacts() {
  const { data: joinedGroupCount } = store.useJoinedGroupsCount();

  useEffect(() => {
    store.findContactSuggestions();
  }, [joinedGroupCount]);
}
