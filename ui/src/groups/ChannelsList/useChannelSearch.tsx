import React, { createContext, useContext } from 'react';

interface ChannelSearchContext {
  searchInput: string;
  setSearchInput: (input: string) => void;
}

const ChannelSearchContext = createContext({
  searchInput: '',
  setSearchInput: (_input: string) => null,
} as ChannelSearchContext);

export function ChannelSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchInput, setSearchInput] = React.useState('');

  const contextValue = React.useMemo(
    () => ({ searchInput, setSearchInput }),
    [searchInput]
  );

  return (
    <ChannelSearchContext.Provider value={contextValue}>
      {children}
    </ChannelSearchContext.Provider>
  );
}

export default function useChannelSearch() {
  const { searchInput, setSearchInput } = useContext(ChannelSearchContext);

  return {
    searchInput,
    setSearchInput,
  };
}
