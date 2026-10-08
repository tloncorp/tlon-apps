import { YStack } from 'tamagui';

import { useTopLevelScrollViewContentInset } from '../../../navigation/useTopLevelContentInset';
import { ScreenScrollView } from '../ScreenScrollView';
import { SettingsSectionsView } from './SettingsSectionsView';
import type { SettingsListProps } from './types';

/**
 * A full-screen settings list. iOS and Android draw it with native list views
 * (`SettingsList.ios.tsx`, `SettingsList.android.tsx`); this is the web list.
 */
export function SettingsList({ sections }: SettingsListProps) {
  // On the Settings section the last rows must clear the bottom safe area,
  // which nothing pinned to the window's edge reserves for them.
  const bottomContentInset = useTopLevelScrollViewContentInset();

  return (
    <ScreenScrollView>
      <YStack
        flex={1}
        padding="$l"
        paddingBottom={bottomContentInset}
        gap="$2xl"
      >
        <SettingsSectionsView sections={sections} />
      </YStack>
    </ScreenScrollView>
  );
}
