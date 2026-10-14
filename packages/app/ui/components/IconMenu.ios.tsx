import { Button, Host, Menu, RNHostView } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  accessibilityLabel as labelModifier,
  buttonStyle,
  menuIndicator,
  menuStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import type { IconMenuProps } from './IconMenu.types';

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
        {items.map((item) => (
          <Button
            key={item.key}
            label={item.title}
            systemImage={
              item.systemImage as ComponentProps<typeof Button>['systemImage']
            }
            role={item.destructive ? 'destructive' : undefined}
            onPress={item.onPress}
          />
        ))}
      </Menu>
    </Host>
  );
}
