import { Button, ButtonProps } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';
import { View } from 'tamagui';

export function OnboardingButton({
  secondary,
  label,
  ...props
}: Omit<ButtonProps, 'label'> & {
  secondary?: boolean;
  label: string;
}) {
  const color = secondary ? '$secondaryText' : '$primaryText';
  return (
    <Button
      size="large"
      fill="solid"
      type="primary"
      shadow
      label={label}
      centered
      width="100%"
      backgroundColor={color}
      borderColor={color}
      pressStyle={{
        backgroundColor: color,
        opacity: 0.9,
      }}
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
