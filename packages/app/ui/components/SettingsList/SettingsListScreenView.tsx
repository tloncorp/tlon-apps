import { LoadingSpinner, useIsWindowNarrow } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { View } from 'tamagui';

import { ScreenHeader, type ScreenHeaderAction } from '../ScreenHeader';
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
  rightActions,
  loadingSubtitle,
  loading = false,
  bottomBar,
  children,
}: {
  title: string;
  sections: SettingsSectionModel[];
  onBackPressed: () => void;
  rightActions?: ScreenHeaderAction[];
  /** A note under the title while the list refreshes. */
  loadingSubtitle?: string | null;
  /** Shows a spinner in place of the list until there is something to list. */
  loading?: boolean;
  bottomBar?: ReactNode;
  /** Anything else the screen mounts, such as its dialogs. */
  children?: ReactNode;
}) {
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor={settingsListPageColor}>
      <ScreenHeader
        title={title}
        backgroundColor={getSettingsListHeaderColor()}
        backAction={isWindowNarrow ? onBackPressed : undefined}
        rightActions={rightActions}
        loadingSubtitle={loadingSubtitle}
        borderBottom
        placement="navigation"
      />
      <View flex={1}>
        {loading ? (
          <View flex={1} alignItems="center" justifyContent="center">
            <LoadingSpinner />
          </View>
        ) : (
          <SettingsList sections={sections} />
        )}
      </View>
      {bottomBar}
      {children}
    </View>
  );
}
