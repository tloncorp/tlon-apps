import { createContext, useContext } from 'react';
import { View } from 'react-native';

import { WebViewScreen } from '../screens/SingletonWebviewScreen';

const AppWebviewContext = createContext<{ webview: React.JSX.Element }>({
  webview: <View />,
});

interface AppWebviewProviderProps {
  children: React.ReactNode;
}

export const WebviewProvider = ({ children }: AppWebviewProviderProps) => {
  const webview = <WebViewScreen initialPath="/" />;
  return (
    <AppWebviewContext.Provider value={{ webview }}>
      {children}
    </AppWebviewContext.Provider>
  );
};

export const useWebViewContext = () => useContext(AppWebviewContext);
