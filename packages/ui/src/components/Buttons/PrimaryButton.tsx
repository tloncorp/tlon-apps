import { ComponentProps, PropsWithChildren } from 'react';

import { View } from '../../core';
import { Button } from '../Button';
import { LoadingSpinner } from '../LoadingSpinner';

// TODO: base button component no work well with icons?
export function PrimaryButton({
  disabled,
  loading,
  children,
  ...rest
}: PropsWithChildren<{ disabled?: boolean; loading?: boolean }> &
  ComponentProps<typeof Button>) {
  return (
    <Button hero disabled={disabled || loading} {...rest}>
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
