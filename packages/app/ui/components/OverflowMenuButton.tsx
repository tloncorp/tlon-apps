import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { ComponentProps } from 'react';
import { View, isWeb } from 'tamagui';

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
      <Button
        backgroundColor={backgroundColor}
        onPress={onPress}
        borderWidth="unset"
        size="$l"
      >
        <Icon type="Overflow" />
      </Button>
    </View>
  );
}
