import { LoadingSpinner, useIsWindowNarrow } from '@tloncorp/ui';
import { type ReactNode, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { View } from 'tamagui';

import { TextInput } from '../Form';
import { ScreenHeader, type ScreenHeaderAction } from '../ScreenHeader';
import { SettingsList } from './SettingsList';
import {
  useSettingsListHeaderColor,
  useSettingsListSurfaces,
} from './settingsListSurfaces';
import type { SettingsListSearch, SettingsSectionModel } from './types';
import { useNativeHeaderSearch } from './useNativeHeaderSearch';

/**
 * On a wide web window, a settings screen that fills the main pane keeps to
 * the column a profile uses.
 */
export const SETTINGS_LIST_COLUMN_WIDTH = 600;

/**
 * A pushed settings screen: its header over a settings list, with an optional
 * bar pinned below. A wide web window shows the screen beside the list that
 * opened it, so it gets no back button; native screens are always pushed, at
 * any width, and always get one.
 */
export function SettingsListScreenView({
  title,
  scrolledTitle,
  subtitle,
  sections,
  onBackPressed,
  showsBackOnWideWindows = false,
  useHorizontalTitleLayout = false,
  headerTestID,
  rightActions,
  loadingSubtitle,
  loading = false,
  search,
  bottomBar,
  maxWidth,
  children,
}: {
  title: string;
  /**
   * iOS only: the title the bar takes once the list has scrolled this far,
   * for a screen that names itself in its own header and leaves the bar clear.
   */
  scrolledTitle?: { title: string; offset: number };
  /** Web only: a line under the title, such as whose settings these are. */
  subtitle?: string;
  sections: SettingsSectionModel[];
  onBackPressed: () => void;
  /** For a screen that wide web windows can only leave by going back. */
  showsBackOnWideWindows?: boolean;
  /** Web only: sets the title beside the back button, as channel headers do. */
  useHorizontalTitleLayout?: boolean;
  headerTestID?: string;
  rightActions?: ScreenHeaderAction[];
  /** A note under the title while the list refreshes. */
  loadingSubtitle?: string | null;
  /** Shows a spinner in place of the list until there is something to list. */
  loading?: boolean;
  /** Native screens search from the navigation bar; web gets a field. */
  search?: SettingsListSearch;
  bottomBar?: ReactNode;
  /** Web only: a centered column for the rows, at most this wide. */
  maxWidth?: number;
  /** Anything else the screen mounts, such as its dialogs. */
  children?: ReactNode;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const { page } = useSettingsListSurfaces();
  const headerColor = useSettingsListHeaderColor();
  useNativeHeaderSearch(loading ? undefined : search);
  const [scrolledPastMark, setScrolledPastMark] = useState(false);
  const scrollMarkOffset = scrolledTitle?.offset;
  const scrollMark = useMemo(
    () =>
      scrollMarkOffset === undefined
        ? undefined
        : { offset: scrollMarkOffset, onCrossed: setScrolledPastMark },
    [scrollMarkOffset]
  );

  return (
    <View flex={1} backgroundColor={page}>
      <ScreenHeader
        title={scrolledTitle && scrolledPastMark ? scrolledTitle.title : title}
        subtitle={subtitle}
        showSubtitle={Boolean(subtitle)}
        backgroundColor={headerColor}
        backAction={
          Platform.OS !== 'web' || isWindowNarrow || showsBackOnWideWindows
            ? onBackPressed
            : undefined
        }
        rightActions={rightActions}
        loadingSubtitle={loadingSubtitle}
        useHorizontalTitleLayout={useHorizontalTitleLayout}
        testID={headerTestID}
        borderBottom
        placement="navigation"
      />
      {search && !loading && Platform.OS === 'web' ? (
        <View
          width="100%"
          maxWidth={maxWidth}
          marginHorizontal="auto"
          paddingHorizontal="$l"
          paddingTop="$l"
        >
          <TextInput
            value={search.value}
            placeholder={search.placeholder}
            onChangeText={search.onChangeText}
            testID={search.testID}
          />
        </View>
      ) : null}
      <View flex={1}>
        {loading ? (
          <View flex={1} alignItems="center" justifyContent="center">
            <LoadingSpinner />
          </View>
        ) : (
          <SettingsList
            sections={sections}
            maxWidth={maxWidth}
            scrollMark={scrollMark}
          />
        )}
      </View>
      {bottomBar}
      {children}
    </View>
  );
}
