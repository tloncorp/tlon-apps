import { Button } from '@tloncorp/ui';
import { LoadingSpinner } from '@tloncorp/ui';
import { ComponentProps, PropsWithChildren } from 'react';
import { ColorTokens, View } from 'tamagui';

import { triggerHaptic } from '../../utils';

// TODO: base button component no work well with icons?
export function PrimaryButton({
  disabled,
  loading,
  children,
  textColor,
  onPress,
  ...rest
}: PropsWithChildren<{
  disabled?: boolean;
  loading?: boolean;
  textColor?: ColorTokens;
}> &
  ComponentProps<typeof Button.Frame>) {
  const handlePress = (args: any) => {
    onPress?.(args);
    triggerHaptic('baseButtonClick');
  };

  return (
    <Button.Frame
      size="medium"
      disabled={disabled || loading}
      backgroundColor="$primaryText"
      borderColor="$primaryText"
      {...rest}
      onPress={handlePress}
    >
      {/* Spacer */}
      <View width={30} paddingHorizontal="$2xl" />
      <Button.Text color={textColor ?? '$background'}>
        {children}
      </Button.Text>
      {loading ? (
        <View width={30} paddingHorizontal="$2xl">
          <LoadingSpinner color={textColor ?? '$white'} />
        </View>
      ) : (
        <View width={30} paddingHorizontal="$2xl" />
      )}
    </Button.Frame>
  );
}
