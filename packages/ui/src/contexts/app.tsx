import { PropsWithChildren, createContext, useContext, useState } from 'react';

// Define the shape of the context data
interface AppContextType {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
}

// Create the context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
export const AppContextProvider = ({
  children,
  value,
}: PropsWithChildren<{
  value?: { theme: 'light' | 'dark'; currentUserId: string };
}>) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(value?.theme ?? 'light');
  const [currentUserId, setCurrentUserId] = useState<string>(
    value?.currentUserId ?? ''
  );

  return (
    <AppContext.Provider
      value={{ theme, setTheme, currentUserId, setCurrentUserId }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Custom hook for using context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
