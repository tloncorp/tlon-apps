import React, { createContext, useContext } from 'react';

interface ChannelListSearchContext {
  searchInput: string;
  setSearchInput: (input: string) => void;
}

const ChannelListSearchContext = createContext({
  searchInput: '',
  setSearchInput: (_input: string) => null,
} as ChannelListSearchContext);

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
    <ChannelListSearchContext.Provider value={contextValue}>
      {children}
    </ChannelListSearchContext.Provider>
  );
}

export default function useChannelListSearch() {
  const { searchInput, setSearchInput } = useContext(ChannelListSearchContext);

  return {
    searchInput,
    setSearchInput,
  };
}
