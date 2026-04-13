import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import React, { ComponentProps, forwardRef } from 'react';
import { TamaguiElement, View, isWeb } from 'tamagui';

/**
 * Minimal overflow trigger button for use in popovers/menus.
 * Just the button - positioning is handled by the parent.
 */
export const OverflowTriggerButton: React.FC<
  ComponentProps<typeof Button.Frame>
> = forwardRef<TamaguiElement, ComponentProps<typeof Button.Frame>>(
  function OverflowTriggerButton(props, ref) {
    return (
      <Button.Frame ref={ref} fill="text" intent="secondary" {...props}>
        <Icon type="Overflow" color="$secondaryText" />
      </Button.Frame>
    );
  }
);

/**
 * @deprecated Use OverflowTriggerButton instead and handle positioning in parent
 */
export function OverflowMenuButton({
  onPress,
  backgroundColor,
  ...viewProps
}: {
  onPress: () => void;
  backgroundColor?: string;
} & ComponentProps<typeof View>) {
  if (!isWeb) {
    return null;
  }

  return (
    <View
      position="absolute"
      top={8}
      right={24}
      width={8}
      height={0}
      {...viewProps}
    >
      <OverflowTriggerButton
        backgroundColor={backgroundColor}
        onPress={onPress}
      />
    </View>
  );
}
