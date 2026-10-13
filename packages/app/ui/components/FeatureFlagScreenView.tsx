import { useMemo } from 'react';

import {
  type SettingsSectionModel,
  SettingsListScreenView,
} from './SettingsList';

export type FeatureFlagTextSetting = {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  secure?: boolean;
  onChange: (value: string) => void;
};

export function FeatureFlagScreenView({
  features,
  textSettings,
  onBackPressed,
  onFlagToggled,
}: {
  features: {
    name: string;
    label: string;
    description?: string;
    enabled: boolean;
  }[];
  textSettings?: FeatureFlagTextSetting[];
  onBackPressed: () => void;
  onFlagToggled: (flagName: string, enabled: boolean) => void;
}) {
  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      {
        key: 'flags',
        rows: features.map((feature) => ({
          key: feature.name,
          title: feature.label,
          subtitle: feature.description,
          toggle: {
            value: feature.enabled,
            onValueChange: (enabled) => onFlagToggled(feature.name, enabled),
          },
        })),
      },
      // Each value gets its own titled group, since a field shows no title.
      ...(textSettings ?? []).map((setting) => ({
        key: setting.key,
        title: setting.label,
        rows: [
          {
            key: setting.key,
            title: setting.label,
            textField: {
              value: setting.value,
              placeholder: setting.placeholder,
              secure: setting.secure,
              onChangeText: setting.onChange,
            },
          },
        ],
      })),
    ],
    [features, onFlagToggled, textSettings]
  );

  return (
    <SettingsListScreenView
      title="Experimental features"
      sections={sections}
      onBackPressed={onBackPressed}
    />
  );
}
