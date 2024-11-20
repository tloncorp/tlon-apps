import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ListItem,
  LoadingSpinner,
  Pressable,
  ScreenHeader,
} from '@tloncorp/ui';
import { useContext, useEffect, useState } from 'react';
import { ScrollView, YStack } from 'tamagui';
import type { ThemeName } from 'tamagui';
import { useThemeName } from 'tamagui';

import { THEME_STORAGE_KEY } from '../../constants';
import { useIsDarkMode } from '../../hooks/useIsDarkMode';
import { RootStackParamList } from '../../navigation/types';
import { ThemeContext, clearTheme, setTheme } from '../../provider';

type Props = NativeStackScreenProps<RootStackParamList, 'Theme'>;

const themes: { label: string; value: ThemeName | 'auto' }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Ocean', value: 'ocean' },
  { label: 'Desert', value: 'desert' },
  { label: 'Forest', value: 'forest' },
  { label: 'Mountain', value: 'mountain' },
];

export function ThemeScreen(props: Props) {
  const currentTheme = useThemeName();
  const { setActiveTheme } = useContext(ThemeContext);
  const isDarkMode = useIsDarkMode();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [loadingTheme, setLoadingTheme] = useState<string | null>(null);

  const handleThemeChange = async (value: ThemeName | 'auto') => {
    setLoadingTheme(value);
    try {
      if (value === 'auto') {
        await clearTheme(setActiveTheme, isDarkMode);
      } else {
        await setTheme(value, setActiveTheme);
      }
      setSelectedTheme(value === 'auto' ? null : value);
    } finally {
      setLoadingTheme(null);
    }
  };

  useEffect(() => {
    // Check selected theme on mount
    const checkSelected = async () => {
      const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      setSelectedTheme(storedTheme);
    };
    checkSelected();
  }, []);

  const isSelected = (value: ThemeName | 'auto') => {
    if (value === 'auto') {
      return !selectedTheme;
    }
    return currentTheme === value;
  };

  return (
    <>
      <ScreenHeader
        title="Theme"
        backAction={() => props.navigation.goBack()}
      />
      <ScrollView>
        <YStack flex={1} padding="$l" gap="$s">
          {themes.map((theme) => (
            <Pressable
              key={theme.value}
              borderRadius="$xl"
              onPress={() => handleThemeChange(theme.value)}
            >
              <ListItem>
                <ListItem.MainContent>
                  <ListItem.Title>{theme.label}</ListItem.Title>
                  {theme.value === 'auto' && (
                    <ListItem.Subtitle>
                      Uses system {isDarkMode ? 'dark' : 'light'} theme
                    </ListItem.Subtitle>
                  )}
                </ListItem.MainContent>
                {loadingTheme === theme.value ? (
                  <ListItem.EndContent paddingRight="$l">
                    <LoadingSpinner color="$primaryText" size="small" />
                  </ListItem.EndContent>
                ) : (
                  isSelected(theme.value) && (
                    <ListItem.SystemIcon
                      icon="Checkmark"
                      color="$primaryText"
                    />
                  )
                )}
              </ListItem>
            </Pressable>
          ))}
        </YStack>
      </ScrollView>
    </>
  );
}
