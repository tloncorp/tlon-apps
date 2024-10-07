import { ComponentProps, PropsWithChildren } from 'react';
import { View } from 'tamagui';

import { Button } from '../Button';

export function OnboardingButton({
  secondary,
  ...props
}: ComponentProps<typeof Button> & {
  secondary?: boolean;
}) {
  const color = secondary ? '$secondaryText' : '$primaryText';
  return (
    <Button
      hero={true}
      shadow={true}
      pressStyle={{
        backgroundColor: color,
        opacity: 0.9,
      }}
      backgroundColor={color}
      width={'100%'}
      justifyContent="center"
      alignItems="center"
      {...props}
    />
  );
}

export function OnboardingButtonWrapper({ children }: PropsWithChildren) {
  return (
    <View paddingVertical="$3xl" paddingHorizontal="$2xl" gap="$2xl">
      {children}
    </View>
  );
}
