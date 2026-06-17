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
  // Primary uses the solid `hero` preset, which renders a high-contrast
  // inverse button (white in dark mode, dark in light mode). Secondary uses an
  // outline so it reads as a clear alternative without the grayed-out look of a
  // filled gray button.
  return (
    <Button
      {...props}
      preset={secondary ? 'outline' : 'hero'}
      size="large"
      centered
      shadow={!secondary}
      label={label}
      width="100%"
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
