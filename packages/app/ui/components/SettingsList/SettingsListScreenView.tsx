import { useIsWindowNarrow } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { View } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';
import { SettingsList } from './SettingsList';
import { getSettingsListHeaderColor } from './settingsListHeaderColor';
import { settingsListPageColor } from './settingsListPageColor';
import type { SettingsSectionModel } from './types';

/**
 * A pushed settings screen: its header over a settings list, with an optional
 * bar pinned below. Wide windows show the screen beside the list that opened
 * it, so they get no back button.
 */
export function SettingsListScreenView({
  title,
  sections,
  onBackPressed,
  bottomBar,
}: {
  title: string;
  sections: SettingsSectionModel[];
  onBackPressed: () => void;
  bottomBar?: ReactNode;
}) {
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor={settingsListPageColor}>
      <ScreenHeader
        title={title}
        backgroundColor={getSettingsListHeaderColor()}
        backAction={isWindowNarrow ? onBackPressed : undefined}
        borderBottom
        placement="navigation"
      />
      <View flex={1}>
        <SettingsList sections={sections} />
      </View>
      {bottomBar}
    </View>
  );
}
