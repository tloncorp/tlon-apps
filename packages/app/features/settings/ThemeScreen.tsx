import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeSettings } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import {
  ThemeMode,
  builtInThemeOptions,
  createCustomThemeDefinition,
  customThemeSlotId,
  getCustomThemeName,
  getCustomThemeRuntimeName,
} from '@tloncorp/shared/utils';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ScrollView, Slider, XStack, YStack } from 'tamagui';
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
  const [customThemeHue, setCustomThemeHue] = useState(210);
  const [customThemeMode, setCustomThemeMode] = useState<ThemeMode>('dark');
  const [savingCustomTheme, setSavingCustomTheme] = useState(false);

  const savedCustomTheme = customThemes[0];
  const customThemeValue = savedCustomTheme
    ? getCustomThemeRuntimeName(savedCustomTheme)
    : getCustomThemeName(customThemeSlotId);

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
      {
        title: 'Custom',
        value: customThemeValue,
      },
    ],
    [customThemeValue, isDarkMode]
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
    if (savingCustomTheme) return null;

    setSavingCustomTheme(true);
    try {
      const customTheme = createCustomThemeDefinition({
        name: 'Custom',
        hue: customThemeHue,
        mode: customThemeMode,
        createdAt: savedCustomTheme?.createdAt,
      });
      const runtimeName = getCustomThemeRuntimeName(customTheme);

      await setCustomThemes([customTheme]);
      await store.updateThemePreference(runtimeName);
      setSelectedTheme(runtimeName);
      return runtimeName;
    } catch (err) {
      console.error('Failed to create custom theme:', err);
      return null;
    } finally {
      setSavingCustomTheme(false);
    }
  };

  const handleCustomThemeChange = async () => {
    if (savedCustomTheme) {
      await handleThemeChange(customThemeValue);
      return;
    }

    await handleCreateCustomTheme();
  };

  useEffect(() => {
    if (!savedCustomTheme) {
      return;
    }

    setCustomThemeHue(savedCustomTheme.params.hue);
    setCustomThemeMode(savedCustomTheme.mode);
  }, [savedCustomTheme]);

  useEffect(() => {
    if (customThemes.length > 1 && savedCustomTheme) {
      setCustomThemes([savedCustomTheme]);
    }
  }, [customThemes.length, savedCustomTheme, setCustomThemes]);

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
          {themes.map((theme) => (
            <Fragment key={theme.value}>
              <Pressable
                disabled={loadingTheme !== null || savingCustomTheme}
                onPress={() =>
                  theme.value === customThemeValue
                    ? handleCustomThemeChange()
                    : handleThemeChange(theme.value)
                }
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
                    {loadingTheme === theme.value ||
                    (theme.value === customThemeValue && savingCustomTheme) ? (
                      <View padding="$m">
                        <LoadingSpinner color="$primaryText" size="small" />
                      </View>
                    ) : (
                      <RadioControl checked={theme.value === selectedTheme} />
                    )}
                  </ListItem.EndContent>
                </ListItem>
              </Pressable>
              {theme.value === customThemeValue &&
                selectedTheme === customThemeValue && (
                  <YStack
                    gap="$m"
                    padding="$l"
                    borderRadius="$xl"
                    backgroundColor="$secondaryBackground"
                    marginHorizontal="$l"
                    marginBottom="$l"
                  >
                    <YStack gap="$m">
                      <XStack justifyContent="space-between" gap="$m">
                        <Text color="$primaryText">Hue</Text>
                        <Text color="$secondaryText">{customThemeHue}</Text>
                      </XStack>
                      <Slider
                        value={[customThemeHue]}
                        min={0}
                        max={359}
                        step={1}
                        onValueChange={([hue]) =>
                          setCustomThemeHue(Math.round(hue ?? customThemeHue))
                        }
                        height="$2xl"
                        aria-label="Hue"
                      >
                        <Slider.Track
                          height="$xs"
                          backgroundColor="$secondaryBackground"
                        >
                          <Slider.TrackActive backgroundColor="$positiveActionText" />
                        </Slider.Track>
                        <Slider.Thumb
                          index={0}
                          size="$3xl"
                          backgroundColor="$primaryBackground"
                          borderColor="$border"
                        />
                      </Slider>
                    </YStack>
                    <YStack gap="$xs">
                      <Pressable
                        onPress={() => setCustomThemeMode('dark')}
                        borderRadius="$xl"
                      >
                        <ListItem>
                          <ListItem.MainContent>
                            <ListItem.Title>Dark</ListItem.Title>
                          </ListItem.MainContent>
                          <ListItem.EndContent>
                            <RadioControl
                              checked={customThemeMode === 'dark'}
                            />
                          </ListItem.EndContent>
                        </ListItem>
                      </Pressable>
                      <Pressable
                        onPress={() => setCustomThemeMode('light')}
                        borderRadius="$xl"
                      >
                        <ListItem>
                          <ListItem.MainContent>
                            <ListItem.Title>Light</ListItem.Title>
                          </ListItem.MainContent>
                          <ListItem.EndContent>
                            <RadioControl
                              checked={customThemeMode === 'light'}
                            />
                          </ListItem.EndContent>
                        </ListItem>
                      </Pressable>
                    </YStack>
                    <Button
                      label={savingCustomTheme ? 'Saving...' : 'Apply custom'}
                      disabled={savingCustomTheme}
                      onPress={handleCreateCustomTheme}
                    />
                  </YStack>
                )}
            </Fragment>
          ))}
        </YStack>
      </ScrollView>
    </View>
  );
}
