import React, { createContext, useMemo, useState } from 'react';

import { useIsMobile } from './useMedia';

export const ChatInputFocusContext = createContext<{
  isChatInputFocused: boolean;
  setIsChatInputFocused: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  isChatInputFocused: false,
  setIsChatInputFocused: () => ({}),
});

export function ChatInputFocusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);

  const contextValue = useMemo(
    () => ({
      isChatInputFocused,
      setIsChatInputFocused,
    }),
    [isChatInputFocused]
  );

  return (
    <ChatInputFocusContext.Provider value={contextValue}>
      {children}
    </ChatInputFocusContext.Provider>
  );
}

export function useChatInputFocus() {
  const { isChatInputFocused, setIsChatInputFocused } = React.useContext(
    ChatInputFocusContext
  );
  const isMobile = useIsMobile();

  const handleFocus = React.useCallback(() => {
    if (isMobile) {
      setIsChatInputFocused(true);
    }
  }, [setIsChatInputFocused, isMobile]);

  const handleBlur = React.useCallback(() => {
    if (isMobile) {
      setIsChatInputFocused(false);
    }
  }, [setIsChatInputFocused, isMobile]);

  return {
    isChatInputFocused,
    handleFocus,
    handleBlur,
  };
}
