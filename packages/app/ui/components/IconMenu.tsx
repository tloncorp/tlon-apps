import { Pressable } from '@tloncorp/ui';

import type { IconMenuProps } from './IconMenu.types';

/** Web opens its own picker sheet rather than a menu. */
export function IconMenu({
  children,
  onPress,
  accessibilityLabel,
  testID,
}: IconMenuProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}
