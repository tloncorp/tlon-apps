import { useJoinedGroupsCount, findContactSuggestions } from '@tloncorp/shared/store';
import { useEffect } from 'react';

export function useFindSuggestedContacts() {
  const { data: joinedGroupCount } = useJoinedGroupsCount();

  useEffect(() => {
    findContactSuggestions();
  }, [joinedGroupCount]);
}
