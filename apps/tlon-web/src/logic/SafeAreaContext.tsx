import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const defaultSafeAreaInsets = window.nativeOptions?.safeAreaInsets ?? {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const SafeAreaContext = createContext({
  safeAreaInsets: defaultSafeAreaInsets,
});

export default function SafeAreaProvider({ children }: PropsWithChildren) {
  const [safeAreaInsets, setSafeAreaInsets] = useState(defaultSafeAreaInsets);

  // This is an attempt to detect the keyboard on mobile devices. Resize event should
  // fire when keyboard is opened and pushes the viewport up. When the viewport is pushed
  // past the bottom safe area inset, we set the bottom inset to 0.
  useEffect(() => {
    const handleViewportResize = () => {
      const viewportOffset = window.visualViewport?.offsetTop ?? 0;
      const bottom =
        viewportOffset > defaultSafeAreaInsets.bottom
          ? 0
          : defaultSafeAreaInsets.bottom;
      setSafeAreaInsets((currentInsets) => ({
        ...currentInsets,
        bottom,
      }));
    };

    window.visualViewport?.addEventListener('resize', handleViewportResize);
    return () =>
      window.visualViewport?.removeEventListener(
        'resize',
        handleViewportResize
      );
  }, []);

  const value = useMemo(() => ({ safeAreaInsets }), [safeAreaInsets]);

  return (
    <SafeAreaContext.Provider value={value}>
      {children}
    </SafeAreaContext.Provider>
  );
}

export const useSafeAreaContext = () => useContext(SafeAreaContext);
