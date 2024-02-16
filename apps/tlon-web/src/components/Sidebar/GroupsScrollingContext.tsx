import React, { useContext } from 'react';

export const GroupsScrollingContext = React.createContext(false);

export function useGroupsScrolling() {
  return useContext(GroupsScrollingContext);
}
