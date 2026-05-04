import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeSettings } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import {
  ThemeHarmony,
  ThemeMode,
  builtInThemeOptions,
  createCustomThemeDefinition,
  customThemeSlotId,
  getCustomThemeName,
  getCustomThemeRuntimeName,
} from '@tloncorp/shared/utils';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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

const harmonyOptions: { title: string; value: ThemeHarmony }[] = [
  { title: 'Analogous', value: 'analogous' },
  { title: 'Monochromatic', value: 'monochromatic' },
  { title: 'Complementary', value: 'complementary' },
  { title: 'Split complementary', value: 'split-complementary' },
  { title: 'Triadic', value: 'triadic' },
];

const modeOptions: { title: string; value: ThemeMode }[] = [
  { title: 'Dark', value: 'dark' },
  { title: 'Light', value: 'light' },
];

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
  const [customThemeHarmony, setCustomThemeHarmony] =
    useState<ThemeHarmony>('analogous');
  const [customThemeAccentSpread, setCustomThemeAccentSpread] = useState(72);
  const [customThemeSaturation, setCustomThemeSaturation] = useState(66);
  const [customThemeBrightness, setCustomThemeBrightness] = useState(82);
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
        harmony: customThemeHarmony,
        width: customThemeAccentSpread,
        saturation: customThemeSaturation,
        brightness: customThemeBrightness,
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
    setCustomThemeHarmony(savedCustomTheme.params.harmony);
    setCustomThemeAccentSpread(savedCustomTheme.params.width);
    setCustomThemeSaturation(savedCustomTheme.params.saturation);
    setCustomThemeBrightness(savedCustomTheme.params.brightness);
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
                    gap="$l"
                    paddingVertical="$l"
                    paddingHorizontal="$xl"
                    borderRadius="$xl"
                    backgroundColor="$secondaryBackground"
                    marginHorizontal="$l"
                    marginBottom="$l"
                  >
                    <CustomThemeSlider
                      label="Hue"
                      value={customThemeHue}
                      min={0}
                      max={359}
                      onValueChange={setCustomThemeHue}
                    />
                    <CustomThemeOptionGroup<ThemeHarmony>
                      label="Harmony"
                      options={harmonyOptions}
                      value={customThemeHarmony}
                      onChange={setCustomThemeHarmony}
                      presentation="scroll"
                    />
                    <CustomThemeSlider
                      label="Accent spread"
                      value={customThemeAccentSpread}
                      min={0}
                      max={100}
                      onValueChange={setCustomThemeAccentSpread}
                    />
                    <CustomThemeSlider
                      label="Saturation"
                      value={customThemeSaturation}
                      min={0}
                      max={100}
                      onValueChange={setCustomThemeSaturation}
                    />
                    <CustomThemeSlider
                      label="Brightness"
                      value={customThemeBrightness}
                      min={0}
                      max={100}
                      onValueChange={setCustomThemeBrightness}
                    />
                    <CustomThemeOptionGroup<ThemeMode>
                      label="Appearance"
                      options={modeOptions}
                      value={customThemeMode}
                      onChange={setCustomThemeMode}
                      presentation="segmented"
                    />
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

function CustomThemeOptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  presentation,
}: {
  label: string;
  options: { title: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  presentation: 'scroll' | 'segmented';
}) {
  const content = (
    <XStack
      gap="$s"
      flexWrap={presentation === 'segmented' ? 'nowrap' : undefined}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Button
            key={option.value}
            onPress={() => onChange(option.value)}
            label={option.title}
            size="small"
            fill={selected ? 'solid' : 'outline'}
            intent="primary"
            centered
            flex={presentation === 'segmented' ? 1 : undefined}
            minWidth={presentation === 'segmented' ? undefined : 128}
          />
        );
      })}
    </XStack>
  );

  return (
    <YStack gap="$m">
      <Text color="$primaryText">{label}</Text>
      {presentation === 'scroll' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 12 }}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </YStack>
  );
}

function CustomThemeSlider({
  label,
  value,
  min,
  max,
  onValueChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const commitValue = useCallback(
    (nextValue: number) => {
      const roundedValue = Math.round(nextValue);
      setLocalValue(roundedValue);
      onValueChange(roundedValue);
    },
    [onValueChange]
  );

  return (
    <YStack gap="$m">
      <XStack justifyContent="space-between" gap="$m">
        <Text color="$primaryText">{label}</Text>
        <Text color="$secondaryText">{localValue}</Text>
      </XStack>
      <Slider
        value={[localValue]}
        min={min}
        max={max}
        step={1}
        onValueChange={([nextValue]) =>
          setLocalValue(Math.round(nextValue ?? localValue))
        }
        onSlideEnd={(_event, nextValue) => commitValue(nextValue)}
        height="$2xl"
        aria-label={label}
      >
        <Slider.Track height="$xs" backgroundColor="$border">
          <Slider.TrackActive backgroundColor="$positiveActionText" />
        </Slider.Track>
        <Slider.Thumb
          index={0}
          size="$3xl"
          circular
          backgroundColor="$primaryBackground"
          borderColor="$border"
        />
      </Slider>
    </YStack>
  );
}
