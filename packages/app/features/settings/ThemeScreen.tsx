import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeSettings } from '@tloncorp/shared';
import { useEffect, useState } from 'react';
import { ScrollView, YStack } from 'tamagui';
import { useTheme } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { useActiveTheme } from '../../provider';
import { AppTheme } from '../../types/theme';
import {
  ListItem,
  ListItemInputOption,
  LoadingSpinner,
  Pressable,
  RadioControl,
  ScreenHeader,
  View,
} from '../../ui';
import { themes } from '../../ui/tamagui.config';
import { normalizeTheme } from '../../ui/utils/themeUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Theme'>;

export function ThemeScreen(props: Props) {
  const theme = useTheme();
  const { data: storedTheme, isLoading } = useThemeSettings();
  const { activeTheme, setActiveTheme, systemIsDark } = useActiveTheme();
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('auto');
  const [loadingTheme, setLoadingTheme] = useState<AppTheme | null>(null);

  const themeOptions: ListItemInputOption<AppTheme>[] = [
    {
      title: 'Auto',
      value: 'auto',
      subtitle: `Uses system ${systemIsDark ? 'dark' : 'light'} theme`,
    },
    { title: 'Tlon Light', value: 'light' },
    { title: 'Tlon Dark', value: 'dark' },
    ...Object.keys(themes)
      .filter((themeName) => themeName !== 'light' && themeName !== 'dark')
      .sort()
      .map((themeName) => ({
        title: themeName.charAt(0).toUpperCase() + themeName.slice(1),
        value: themeName as AppTheme,
      })),
  ];

  const handleThemeChange = async (value: AppTheme) => {
    if (value === selectedTheme || loadingTheme) return;

    setLoadingTheme(value);
    try {
      await setActiveTheme(value);
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
    const normalizedActiveTheme =
      (activeTheme === 'dark' || activeTheme === 'light') &&
      normalizeTheme(storedTheme ?? null) === 'auto'
        ? 'auto'
        : activeTheme;

    if (normalizedActiveTheme !== selectedTheme && !isLoading) {
      setSelectedTheme(normalizedActiveTheme);
    }
  }, [activeTheme, selectedTheme, isLoading, storedTheme]);

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
          {themeOptions.map((themeOption) => (
            <Pressable
              key={themeOption.value}
              disabled={loadingTheme !== null}
              onPress={() => handleThemeChange(themeOption.value)}
              borderRadius="$xl"
            >
              <ListItem>
                <ListItem.MainContent>
                  <ListItem.Title>{themeOption.title}</ListItem.Title>
                  {themeOption.subtitle && (
                    <ListItem.Subtitle>
                      {themeOption.subtitle}
                    </ListItem.Subtitle>
                  )}
                </ListItem.MainContent>
                <ListItem.EndContent>
                  {loadingTheme === themeOption.value ? (
                    <View padding="$m">
                      <LoadingSpinner color="$primaryText" size="small" />
                    </View>
                  ) : (
                    <RadioControl
                      checked={themeOption.value === selectedTheme}
                    />
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
