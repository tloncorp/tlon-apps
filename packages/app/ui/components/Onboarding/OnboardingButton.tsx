import { Button, ButtonProps } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';
import { View } from 'tamagui';

type OnboardingButtonProps = Omit<
  ButtonProps,
  'label' | 'icon' | 'leadingIcon' | 'trailingIcon'
> & {
  secondary?: boolean;
  label: string;
};

export function OnboardingButton({
  secondary,
  label,
  ...props
}: OnboardingButtonProps) {
  const color = secondary ? '$secondaryText' : '$primaryText';
  return (
    <Button
      {...props}
      preset="primary"
      size="large"
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
