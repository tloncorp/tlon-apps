import { throttle } from 'lodash';
import React, { createContext, useMemo, useState } from 'react';

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

  const throttledSetIsChatInputFocused = useMemo(
    () => throttle(setIsChatInputFocused, 100),
    [setIsChatInputFocused]
  );

  const handleFocus = React.useCallback(() => {
    throttledSetIsChatInputFocused(true);
  }, [throttledSetIsChatInputFocused]);

  const handleBlur = React.useCallback(() => {
    throttledSetIsChatInputFocused(false);
  }, [throttledSetIsChatInputFocused]);

  return {
    isChatInputFocused,
    handleFocus,
    handleBlur,
  };
}
