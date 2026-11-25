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

/** The big solid button: the standard 56 pt button, full width, and flat. */
export function OnboardingButton({
  secondary,
  label,
  shadow = false,
  ...props
}: OnboardingButtonProps) {
  const color = secondary ? '$secondaryText' : '$primaryText';
  return (
    <Button
      {...props}
      preset="hero"
      size="medium"
      shadow={shadow}
      label={label}
      width="100%"
      // A disabled button keeps the hero preset's own light gray.
      {...(props.disabled
        ? {}
        : {
            backgroundColor: color,
            borderColor: color,
            pressStyle: { backgroundColor: color, opacity: 0.9 },
          })}
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
