import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Appearance,
  useColorScheme,
} from 'react-native';

export const useIsDarkMode = () => {
  const colorScheme = useColorScheme();
  // Platform-specific workarounds for color scheme detection:
  //
  // iOS: The color scheme will temporarily change to 'light' when the app is
  // backgrounded, regardless of actual system appearance settings. We ignore
  // scheme changes that occur while backgrounded to avoid flickering.
  //
  // Android: useColorScheme() doesn't reliably update when the system theme
  // changes while the app is backgrounded for extended periods. We query
  // Appearance.getColorScheme() directly when returning to foreground to get
  // a fresh (non-cached) value and ensure theme sync after long background periods.
  const isInForeground = useRef<boolean>(AppState.currentState === 'active');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(colorScheme === 'dark');

  // Listen for AppState changes to detect foreground/background transitions
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const wasInBackground = !isInForeground.current;
        const isNowInForeground = nextAppState === 'active';

        isInForeground.current = isNowInForeground;

        // When returning to foreground, query the color scheme directly to get
        // a fresh value. This works around Android's issue where useColorScheme()
        // may have a stale value after long background periods.
        if (wasInBackground && isNowInForeground) {
          const freshColorScheme = Appearance.getColorScheme();
          setIsDarkMode(freshColorScheme === 'dark');
        }
      }
    );
    return () => appStateSubscription.remove();
  }, []);

  // Listen for color scheme changes while app is in foreground
  // (from useColorScheme hook dependency)
  useEffect(() => {
    // Only apply changes if we're currently foregrounded (iOS workaround)
    if (isInForeground.current) {
      setIsDarkMode(colorScheme === 'dark');
    }
  }, [colorScheme]);

  // Add Appearance change listener as backup to catch theme changes
  // while app is active (supplements useColorScheme hook on Android)
  useEffect(() => {
    const appearanceSubscription = Appearance.addChangeListener(
      ({ colorScheme: newColorScheme }) => {
        // Only apply if foregrounded (iOS workaround)
        if (isInForeground.current) {
          setIsDarkMode(newColorScheme === 'dark');
        }
      }
    );
    return () => appearanceSubscription.remove();
  }, []);

  return isDarkMode;
};
