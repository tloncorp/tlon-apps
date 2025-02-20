import { ComponentProps, PropsWithChildren } from 'react';
import { View } from 'tamagui';

import { triggerHaptic } from '../../utils';
import { Button } from '../../tmp/components/Button';
import { LoadingSpinner } from '../../tmp/components/LoadingSpinner';

// TODO: base button component no work well with icons?
export function PrimaryButton({
  disabled,
  loading,
  children,
  onPress,
  ...rest
}: PropsWithChildren<{ disabled?: boolean; loading?: boolean }> &
  ComponentProps<typeof Button>) {
  const handlePress = (args: any) => {
    onPress?.(args);
    triggerHaptic('baseButtonClick');
  };

  return (
    <Button hero disabled={disabled || loading} {...rest} onPress={handlePress}>
      {/* Spacer */}
      <View width={30} paddingHorizontal="$2xl" />
      <Button.Text width="auto">{children}</Button.Text>
      {loading ? (
        <View width={30} paddingHorizontal="$2xl">
          <LoadingSpinner color="$white" />
        </View>
      ) : (
        <View width={30} paddingHorizontal="$2xl" />
      )}
    </Button>
  );
}
