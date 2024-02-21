import React, { useContext } from 'react';

export const MessagesScrollingContext = React.createContext(false);

export function useMessagesScrolling() {
  return useContext(MessagesScrollingContext);
}
