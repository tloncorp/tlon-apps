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

/** The big solid button: 56 pt tall with 12 pt corners, and flat. */
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
      shadow={shadow}
      label={label}
      width="100%"
      height={56}
      borderRadius={12}
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
