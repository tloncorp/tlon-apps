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
import { normalizeTheme } from '../../ui/utils/themeUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Theme'>;

export function ThemeScreen(props: Props) {
  const theme = useTheme();
  const { data: storedTheme, isLoading } = useThemeSettings();
  const { activeTheme, setActiveTheme, systemIsDark } = useActiveTheme();
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('auto');
  const [loadingTheme, setLoadingTheme] = useState<AppTheme | null>(null);

  const themes: ListItemInputOption<AppTheme>[] = [
    {
      title: 'Auto',
      value: 'auto',
      subtitle: `Uses system ${systemIsDark ? 'dark' : 'light'} theme`,
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
