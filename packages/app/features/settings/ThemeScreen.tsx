import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeSettings } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import {
  ThemeMode,
  builtInThemeOptions,
  createCustomThemeDefinition,
  getCustomThemeRuntimeName,
} from '@tloncorp/shared/utils';
import { useEffect, useMemo, useState } from 'react';
import { Input, ScrollView, XStack, YStack } from 'tamagui';
import { useTheme } from 'tamagui';

import { useIsDarkMode } from '../../hooks/useIsDarkMode';
import { RootStackParamList } from '../../navigation/types';
import { AppTheme } from '../../types/theme';
import {
  Button,
  ListItem,
  ListItemInputOption,
  LoadingSpinner,
  Pressable,
  RadioControl,
  ScreenHeader,
  Text,
  View,
  useIsWindowNarrow,
} from '../../ui';
import { normalizeTheme } from '../../ui/utils/themeUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Theme'>;

export function ThemeScreen(props: Props) {
  const theme = useTheme();
  const { data: storedTheme, isLoading } = useThemeSettings();
  const { value: localThemePreference } = store.useLocalThemePreference();
  const { value: customThemes, setValue: setCustomThemes } =
    store.useCustomThemes();
  const isDarkMode = useIsDarkMode();
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('auto');
  const [loadingTheme, setLoadingTheme] = useState<AppTheme | null>(null);
  const [customThemeName, setCustomThemeName] = useState('My Theme');
  const [customThemeHue, setCustomThemeHue] = useState('210');
  const [customThemeMode, setCustomThemeMode] = useState<ThemeMode>('dark');
  const [savingCustomTheme, setSavingCustomTheme] = useState(false);

  const customThemeNames = useMemo(
    () => customThemes.map(getCustomThemeRuntimeName),
    [customThemes]
  );

  const themes: ListItemInputOption<AppTheme>[] = useMemo(
    () => [
      {
        title: 'Auto',
        value: 'auto',
        subtitle: `Uses system ${isDarkMode ? 'dark' : 'light'} theme`,
      },
      ...builtInThemeOptions,
      ...customThemes.map((customTheme) => ({
        title: customTheme.name,
        value: getCustomThemeRuntimeName(customTheme),
        subtitle: `Local custom ${customTheme.mode} theme`,
      })),
    ],
    [customThemes, isDarkMode]
  );

  const handleThemeChange = async (value: AppTheme) => {
    if (value === selectedTheme || loadingTheme) return;

    setLoadingTheme(value);
    try {
      await store.updateThemePreference(value);
      setSelectedTheme(value);
    } catch (err) {
      console.error('Failed to save theme preference:', err);
    } finally {
      setLoadingTheme(null);
    }
  };

  const handleCreateCustomTheme = async () => {
    if (savingCustomTheme) return;

    const hue = Number.parseInt(customThemeHue, 10);
    if (!Number.isFinite(hue)) return;

    setSavingCustomTheme(true);
    try {
      const customTheme = createCustomThemeDefinition({
        name: customThemeName,
        hue,
        mode: customThemeMode,
      });
      const runtimeName = getCustomThemeRuntimeName(customTheme);

      await setCustomThemes((themes) => [...themes, customTheme]);
      await store.updateThemePreference(runtimeName);
      setSelectedTheme(runtimeName);
      setCustomThemeName('My Theme');
    } catch (err) {
      console.error('Failed to create custom theme:', err);
    } finally {
      setSavingCustomTheme(false);
    }
  };

  useEffect(() => {
    if (!isLoading && storedTheme !== undefined) {
      setSelectedTheme(
        normalizeTheme(localThemePreference ?? storedTheme, customThemeNames)
      );
    }
  }, [storedTheme, localThemePreference, customThemeNames, isLoading]);

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View backgroundColor={theme?.background?.val} flex={1}>
      <ScreenHeader
        title="Theme"
        borderBottom
        backAction={
          isWindowNarrow ? () => props.navigation.goBack() : undefined
        }
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
          <YStack
            gap="$m"
            padding="$l"
            borderColor="$border"
            borderWidth={1}
            borderRadius="$xl"
            marginBottom="$l"
          >
            <Text fontWeight="$l">Custom theme</Text>
            <Input
              value={customThemeName}
              onChangeText={setCustomThemeName}
              placeholder="Theme name"
              backgroundColor="$secondaryBackground"
              borderColor="$border"
              color="$primaryText"
            />
            <Input
              value={customThemeHue}
              onChangeText={setCustomThemeHue}
              inputMode="numeric"
              keyboardType="number-pad"
              placeholder="Hue 0-359"
              backgroundColor="$secondaryBackground"
              borderColor="$border"
              color="$primaryText"
            />
            <XStack gap="$s">
              <Button
                label="Dark"
                fill={customThemeMode === 'dark' ? 'solid' : 'outline'}
                onPress={() => setCustomThemeMode('dark')}
              />
              <Button
                label="Light"
                fill={customThemeMode === 'light' ? 'solid' : 'outline'}
                onPress={() => setCustomThemeMode('light')}
              />
            </XStack>
            <Button
              label={savingCustomTheme ? 'Saving...' : 'Generate and apply'}
              disabled={savingCustomTheme}
              onPress={handleCreateCustomTheme}
            />
          </YStack>
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
