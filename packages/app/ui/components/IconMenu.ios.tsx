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

/**
 * Opens a native menu from any content: what can be done to an image, or
 * what an overflow button offers.
 */
export function IconMenu({
  children,
  items,
  accessibilityLabel,
  testID,
}: IconMenuProps) {
  return (
    // The menu opens natively, so React Native would hand the same touch to
    // a pressable row around it as well. Claiming the touch here keeps it.
    <View onStartShouldSetResponder={() => true}>
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
    </View>
  );
}
