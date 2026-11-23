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

/**
 * The big solid button. Only the welcome screen's buttons cast a shadow;
 * the onboarding steps pass `shadow={false}`.
 */
export function OnboardingButton({
  secondary,
  label,
  shadow = true,
  ...props
}: OnboardingButtonProps) {
  const color = secondary ? '$secondaryText' : '$primaryText';
  return (
    <Button
      {...props}
      preset="hero"
      shadow={shadow}
      label={label}
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
