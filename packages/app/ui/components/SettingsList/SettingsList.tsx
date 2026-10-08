import { YStack } from 'tamagui';

import { useTopLevelTabBarContentInset } from '../../../navigation/useTopLevelTabBarContentInset';
import { ScreenScrollView } from '../ScreenScrollView';
import { SettingsSectionsView } from './SettingsSectionsView';
import type { SettingsListProps } from './types';

/**
 * A full-screen settings list. iOS and Android draw it with native list views
 * (`SettingsList.ios.tsx`, `SettingsList.android.tsx`); this is the web list.
 */
export function SettingsList({ sections }: SettingsListProps) {
  // On the Settings tab the last rows must clear the bar that floats over the
  // bottom of the screen.
  const bottomContentInset = useTopLevelTabBarContentInset();

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
