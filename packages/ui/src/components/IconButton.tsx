import { ComponentProps, PropsWithChildren } from 'react';
import { ColorTokens, RadiusTokens, ThemeTokens } from 'tamagui';

import { Button } from './Button';

export type IconButtonProps = PropsWithChildren<{
  color?: ThemeTokens | ColorTokens;
  backgroundColorOnPress?: ThemeTokens | ColorTokens;
  radius?: RadiusTokens;
}> &
  ComponentProps<typeof Button>;

export function IconButton({
  children,
  onPress,
  size = '$s',
  color = '$primaryText',
  backgroundColor = '$background',
  backgroundColorOnPress = '$secondaryBackground',
  disabled = false,
  radius = '$radius.l',
  style,
  pressStyle,
  borderWidth = 'unset',
  width,
  ...rest
}: IconButtonProps) {
  return (
    <Button
      size={size}
      onPress={onPress}
      disabled={disabled}
      borderRadius={radius}
      style={style}
      width={width}
      pressStyle={{
        backgroundColor: backgroundColorOnPress,
        ...pressStyle,
      }}
      backgroundColor={backgroundColor}
      borderWidth={borderWidth}
      {...rest}
    >
      <Button.Icon color={color}>{children}</Button.Icon>
    </Button>
  );
}
