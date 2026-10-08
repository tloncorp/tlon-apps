import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeSettings } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useEffect, useState } from 'react';

import { RootStackParamList } from '../../navigation/types';
import { AppTheme } from '../../types/theme';
import {
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import { normalizeTheme } from '../../ui/utils/themeUtils';
import { THEME_OPTIONS } from './themeOptions';

type Props = NativeStackScreenProps<RootStackParamList, 'Theme'>;

export function ThemeScreen(props: Props) {
  const { data: storedTheme, isLoading } = useThemeSettings();
  const { data: showDeleteMarkers = false } = store.useShowDeleteMarkers();
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('auto');
  const [loadingTheme, setLoadingTheme] = useState<AppTheme | null>(null);

  const themes = THEME_OPTIONS;

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

  const sections: SettingsSectionModel[] = [
    {
      key: 'messages',
      title: 'Messages',
      rows: [
        {
          key: 'show-delete-markers',
          title: 'Show deleted messages',
          subtitle: 'Show a placeholder for deleted messages',
          toggle: {
            value: showDeleteMarkers,
            onValueChange: handleShowDeleteMarkersChange,
          },
          testID: 'ShowDeleteMarkersToggle',
        },
      ],
    },
    {
      key: 'theme',
      title: 'Theme',
      rows: themes.map((theme) => ({
        key: theme.value,
        title: theme.title,
        subtitle: theme.subtitle,
        selected: theme.value === selectedTheme,
        disabled: loadingTheme !== null,
        onPress: () => handleThemeChange(theme.value),
        testID: `ThemeOption-${theme.value}`,
      })),
    },
  ];

  return (
    <SettingsListScreenView
      title="Appearance"
      sections={sections}
      onBackPressed={() => props.navigation.goBack()}
    />
  );
}
