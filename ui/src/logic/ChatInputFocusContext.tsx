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
    [isChatInputFocused, setIsChatInputFocused]
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

  const handleFocus = React.useCallback(() => {
    setIsChatInputFocused(true);
  }, [setIsChatInputFocused]);

  const handleBlur = React.useCallback(() => {
    setIsChatInputFocused(false);
  }, [setIsChatInputFocused]);

  return {
    isChatInputFocused,
    handleFocus,
    handleBlur,
  };
}
