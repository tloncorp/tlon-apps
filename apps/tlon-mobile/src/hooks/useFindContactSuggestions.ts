import * as store from '@tloncorp/shared/store';
import { useEffect } from 'react';

export default function useFindContactSuggestions() {
  const { data: numJoinedGroups } = store.useJoinedGroupsCount();

  useEffect(() => {
    store.findContactSuggestions();
  }, [numJoinedGroups]);
}
