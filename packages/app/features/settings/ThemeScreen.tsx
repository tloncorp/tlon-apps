import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeSettings } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { Fragment, useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { AppTheme } from '../../types/theme';
import {
  ListItem,
  ListItemInputOption,
  LoadingSpinner,
  Pressable,
  RadioControl,
  ScreenHeader,
  SettingsContentScrollView,
  SettingsDivider,
  SettingsSection,
  View,
  useIsWindowNarrow,
} from '../../ui';
import { normalizeTheme } from '../../ui/utils/themeUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Theme'>;

export function ThemeScreen(props: Props) {
  const { data: storedTheme, isLoading } = useThemeSettings();
  const { data: showDeleteMarkers = false } = store.useShowDeleteMarkers();
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('auto');
  const [loadingTheme, setLoadingTheme] = useState<AppTheme | null>(null);

  const themes: ListItemInputOption<AppTheme>[] = [
    {
      title: 'Auto',
      value: 'auto',
      subtitle: 'Uses your system appearance',
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
      await store.updateTheme(value);
      setSelectedTheme(value);
    } catch (err) {
      console.error('Failed to save theme preference:', err);
    } finally {
      setLoadingTheme(null);
    }
  };

  const handleShowDeleteMarkersChange = async (value: boolean) => {
    await store.updateShowDeleteMarkers(value);
  };

  useEffect(() => {
    if (!isLoading && storedTheme !== undefined) {
      setSelectedTheme(normalizeTheme(storedTheme));
    }
  }, [storedTheme, isLoading]);

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View backgroundColor="$secondaryBackground" flex={1}>
      <ScreenHeader
        title="Appearance"
        borderBottom
        backAction={
          isWindowNarrow ? () => props.navigation.goBack() : undefined
        }
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        paddingBottom="$2xl"
      >
        <YStack gap="$2xl">
          <SettingsSection title="Messages">
            <ListItem>
              <ListItem.MainContent>
                <ListItem.Title>Show deleted messages</ListItem.Title>
                <ListItem.Subtitle>
                  Show a placeholder for deleted messages
                </ListItem.Subtitle>
              </ListItem.MainContent>
              <ListItem.EndContent>
                <Switch
                  value={showDeleteMarkers}
                  onValueChange={handleShowDeleteMarkersChange}
                  testID="ShowDeleteMarkersToggle"
                />
              </ListItem.EndContent>
            </ListItem>
          </SettingsSection>
          <SettingsSection title="Theme">
            {themes.map((theme, index) => (
              <Fragment key={theme.value}>
                <Pressable
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
                {index < themes.length - 1 ? <SettingsDivider /> : null}
              </Fragment>
            ))}
          </SettingsSection>
        </YStack>
      </SettingsContentScrollView>
    </View>
  );
}
