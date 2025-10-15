import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, useColorScheme } from 'react-native';

export const useIsDarkMode = () => {
  const colorScheme = useColorScheme();
  // On iOS, the color scheme will temporarily change to 'light' when the app is
  // backgrounded, regardless of actual system appearance settings, so we ignore
  // scheme changes that occur while the app is backgrounded. We do still need
  // to capture intentional changes to the system theme, so we apply the most
  // recent pending change when the app returns to the foreground. The most
  // recent scheme value will be correct, we just want to skip applying the
  // erroneous 'light' values to avoid flickering.
  const isInForeground = useRef<boolean>(AppState.currentState === 'active');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(colorScheme === 'dark');

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const wasInBackground = !isInForeground.current;
        const isNowInForeground = nextAppState === 'active';

        isInForeground.current = isNowInForeground;

        // If app is returning to foreground, apply any pending color scheme change
        if (wasInBackground && isNowInForeground) {
          setIsDarkMode(colorScheme === 'dark');
        }
      }
    );
    return () => appStateSubscription.remove();
  }, [colorScheme]);

  useEffect(() => {
    // Only apply changes if we're currently foregrounded
    if (isInForeground.current) {
      setIsDarkMode(colorScheme === 'dark');
    }
  }, [colorScheme]);

  return isDarkMode;
};
