import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Appearance,
  NativeModules,
  Platform,
  useColorScheme,
} from 'react-native';

// Native module that queries Android's Configuration directly, bypassing
// React Native's Appearance module which can return stale values when the
// system theme changes while the app is backgrounded.
const TlonTheme = NativeModules.TlonTheme;

export const useIsDarkMode = () => {
  const colorScheme = useColorScheme();
  // Platform-specific workarounds for color scheme detection:
  //
  // iOS: The color scheme will temporarily change to 'light' when the app is
  // backgrounded, regardless of actual system appearance settings. We ignore
  // scheme changes that occur while backgrounded to avoid flickering.
  //
  // Android: React Native's Appearance API returns stale values when the system
  // theme changes while the app is backgrounded. We use a native module
  // (TlonTheme) to query Android's Configuration.uiMode directly when returning
  // to foreground.
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
        // a fresh value.
        if (wasInBackground && isNowInForeground) {
          if (Platform.OS === 'android' && TlonTheme) {
            // Android: use native module (Appearance API returns stale values)
            TlonTheme.getColorScheme()
              .then((scheme: string) => setIsDarkMode(scheme === 'dark'))
              .catch(() => {
                // Fallback to Appearance API
                const freshColorScheme = Appearance.getColorScheme();
                setIsDarkMode(freshColorScheme === 'dark');
              });
          } else {
            // iOS: Appearance API works correctly
            const freshColorScheme = Appearance.getColorScheme();
            setIsDarkMode(freshColorScheme === 'dark');
          }
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
  // while app is active (supplements useColorScheme hook)
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
