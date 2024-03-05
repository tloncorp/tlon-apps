import { createContext, useContext, useState } from 'react';

export interface WebviewPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// This is separated out to avoid needing to rerender dependent screens/stacks.
// For example when the keyboard is shown, the webview needs to be resized without losing focus.
export interface WebviewPositionContext {
  visible: boolean;
  position: WebviewPosition;
  setPosition: (position: WebviewPosition) => void;
  setVisibility: (visible: boolean) => void;
}
const WebviewPositionContext = createContext<WebviewPositionContext>({
  visible: false,
  position: { x: 0, y: 0, width: 0, height: 0 },
  setPosition: () => {},
  setVisibility: () => {},
});

export const WebviewPositionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [visible, setVisibility] = useState(false);
  const [position, setPosition] = useState<WebviewPosition>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  return (
    <WebviewPositionContext.Provider
      value={{
        visible,
        position,
        setPosition,
        setVisibility,
      }}
    >
      {children}
    </WebviewPositionContext.Provider>
  );
};

export const useWebviewPositionContext = () =>
  useContext(WebviewPositionContext);
