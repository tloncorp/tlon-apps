import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { subscribeToSettings } from '@tloncorp/shared/api';
import { themeSettings } from '@tloncorp/shared/db';
import { syncSettings } from '@tloncorp/shared/store';
import { useContext, useEffect, useState } from 'react';
import { ScrollView, YStack } from 'tamagui';
import type { ThemeName } from 'tamagui';
import { useTheme } from 'tamagui';

import { useIsDarkMode } from '../../hooks/useIsDarkMode';
import { RootStackParamList } from '../../navigation/types';
import { ThemeContext, clearTheme, setTheme } from '../../provider';
import {
  ListItem,
  ListItemInputOption,
  LoadingSpinner,
  Pressable,
  RadioControl,
  ScreenHeader,
  View,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Theme'>;

export function ThemeScreen(props: Props) {
  const theme = useTheme();
  const { setActiveTheme, activeTheme } = useContext(ThemeContext);
  const isDarkMode = useIsDarkMode();
  const [selectedTheme, setSelectedTheme] = useState<ThemeName | 'auto'>(
    'auto'
  );
  const [loadingTheme, setLoadingTheme] = useState<ThemeName | 'auto' | null>(
    null
  );

  const themes: ListItemInputOption<ThemeName | 'auto'>[] = [
    {
      title: 'Auto',
      value: 'auto',
      subtitle: `Uses system ${isDarkMode ? 'dark' : 'light'} theme`,
    },
    { title: 'Tlon Light', value: 'light' },
    { title: 'Tlon Dark', value: 'dark' },
    { title: 'Dracula', value: 'dracula' },
    { title: 'Greenscreen', value: 'greenscreen' },
    { title: 'Gruvbox', value: 'gruvbox' },
    { title: 'Monokai', value: 'monokai' },
    { title: 'Nord', value: 'nord' },
    { title: 'Peony', value: 'peony' },
    { title: 'Solarized', value: 'solarized' },
  ];

  // Apply a theme and update all states
  const handleThemeChange = async (value: ThemeName | 'auto') => {
    if (value === selectedTheme || loadingTheme) return;

    setLoadingTheme(value);
    try {
      if (value === 'auto') {
        await clearTheme(setActiveTheme, isDarkMode);
      } else {
        await setTheme(value, setActiveTheme);
      }

      // Immediately update selected theme in UI
      setSelectedTheme(value);
    } finally {
      setLoadingTheme(null);
    }
  };

  // Handle theme syncing and updates
  useEffect(() => {
    const syncAndUpdateTheme = async () => {
      try {
        // First sync with backend to get latest settings
        await syncSettings();

        // Then get the theme from local storage (which should be updated after sync)
        const storedTheme = await themeSettings.getValue();

        // Update the selection in the UI to match current theme
        setSelectedTheme(storedTheme ?? 'auto');
      } catch (error) {
        console.warn('Failed to sync theme settings:', error);

        // Fallback to just checking local storage
        const storedTheme = await themeSettings.getValue();
        setSelectedTheme(storedTheme ?? 'auto');
      }
    };

    // Initial check
    syncAndUpdateTheme();

    // Set up subscription to catch theme changes from other clients
    subscribeToSettings((update) => {
      if (update.type === 'updateSetting' && 'theme' in update.setting) {
        const newTheme = update.setting.theme as ThemeName | 'auto' | null;
        console.log('Theme updated from another client:', newTheme);

        // Handle both null and 'auto' values as 'auto'
        const themeValue =
          newTheme === null || newTheme === 'auto' ? 'auto' : newTheme;

        // Update selection in the settings screen
        setSelectedTheme(themeValue);

        // Also apply the theme directly if needed
        if (themeValue === 'auto') {
          // If auto selected, apply system theme
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        } else {
          // Otherwise use specified theme
          setActiveTheme(themeValue);
        }
      }
    });

    // Refresh settings when the screen is focused
    const unsubscribe = props.navigation.addListener('focus', () => {
      syncAndUpdateTheme();
    });

    return unsubscribe;
  }, [props.navigation, isDarkMode, setActiveTheme]);

  return (
    <View backgroundColor={theme?.background?.val} flex={1}>
      <ScreenHeader
        title="Theme"
        backAction={() => props.navigation.goBack()}
      />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 600,
          marginHorizontal: 'auto',
        }}
      >
        <YStack flex={1} padding="$l">
          {themes.map((theme) => (
            <Pressable
              key={theme.value}
              disabled={loadingTheme !== null}
              onPress={() => handleThemeChange(theme.value)}
              borderRadius="$xl"
            >
              <ListItem>
                <ListItem.MainContent>
                  <ListItem.Title>{theme.title}</ListItem.Title>
                  {theme.subtitle && (
                    <ListItem.Subtitle>{theme.subtitle}</ListItem.Subtitle>
                  )}
                </ListItem.MainContent>
                <ListItem.EndContent>
                  {loadingTheme === theme.value ? (
                    <View padding="$m">
                      <LoadingSpinner color="$primaryText" size="small" />
                    </View>
                  ) : (
                    <RadioControl checked={theme.value === selectedTheme} />
                  )}
                </ListItem.EndContent>
              </ListItem>
            </Pressable>
          ))}
        </YStack>
      </ScrollView>
    </View>
  );
}
