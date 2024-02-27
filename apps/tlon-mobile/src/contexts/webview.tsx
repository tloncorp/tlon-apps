import { createContext, useContext } from 'react';

const AppWebviewContext = createContext<{ url: string }>({
  url: '/',
});

interface AppWebviewProviderProps {
  children: React.ReactNode;
}

export const WebviewProvider = ({ children }: AppWebviewProviderProps) => {
  return (
    <AppWebviewContext.Provider value={{ url: '/' }}>
      {children}
    </AppWebviewContext.Provider>
  );
};

export const useWebViewContext = () => useContext(AppWebviewContext);
