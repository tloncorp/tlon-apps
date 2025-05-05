import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeSettings } from '@tloncorp/shared';
import { subscribeToSettings } from '@tloncorp/shared/api';
import { useContext, useEffect, useState } from 'react';
import { ScrollView, YStack } from 'tamagui';
import type { ThemeName } from 'tamagui';
import { useTheme } from 'tamagui';

import { useIsDarkMode } from '../../hooks/useIsDarkMode';
import { RootStackParamList } from '../../navigation/types';
import { normalizeTheme } from '../../provider';
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
  const { data: storedTheme, isLoading } = useThemeSettings();
  const { setActiveTheme } = useContext(ThemeContext);
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

  const handleThemeChange = async (value: ThemeName | 'auto') => {
    if (value === selectedTheme || loadingTheme) return;

    setLoadingTheme(value);
    try {
      if (value === 'auto') {
        setActiveTheme(isDarkMode ? 'dark' : 'light');
        await clearTheme(setActiveTheme, isDarkMode);
      } else {
        setActiveTheme(value);
        await setTheme(value, setActiveTheme);
      }
      setSelectedTheme(value);
    } finally {
      setLoadingTheme(null);
    }
  };

  useEffect(() => {
    if (!isLoading && storedTheme !== undefined) {
      setSelectedTheme(normalizeTheme(storedTheme));
    }
  }, [storedTheme, isLoading]);

  useEffect(() => {
    subscribeToSettings((update) => {
      if (update.type === 'updateSetting' && 'theme' in update.setting) {
        const newTheme = update.setting.theme;
        const themeValue = normalizeTheme(newTheme as any);

        setSelectedTheme(themeValue);

        if (themeValue === 'auto') {
          setActiveTheme(isDarkMode ? 'dark' : 'light');
        } else {
          setActiveTheme(themeValue);
        }
      }
    });
  }, [isDarkMode, setActiveTheme]);

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
