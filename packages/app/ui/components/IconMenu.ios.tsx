import { Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  accessibilityLabel as labelModifier,
  buttonStyle,
  menuIndicator,
  menuStyle,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import type { IconMenuProps } from './IconMenu.types';
import { SwiftUIMenuItems } from './SettingsList/SwiftUIMenuItems';

/** Opens a native menu of what can be done to an image, from any content. */
export function IconMenu({
  children,
  items,
  accessibilityLabel,
  testID,
}: IconMenuProps) {
  return (
    <Host matchContents>
      <Menu
        label={
          <RNHostView matchContents>
            <View>{children}</View>
          </RNHostView>
        }
        modifiers={[
          menuStyle('button'),
          buttonStyle('plain'),
          menuIndicator('hidden'),
          labelModifier(accessibilityLabel),
          ...(testID ? [accessibilityIdentifier(testID)] : []),
        ]}
      >
        <SwiftUIMenuItems items={items} />
      </Menu>
    </Host>
  );
}
