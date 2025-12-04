import { cloneElement, ComponentProps, isValidElement, PropsWithChildren } from 'react';
import { ColorTokens, RadiusTokens, ThemeTokens } from 'tamagui';

import { Button } from './ButtonV2';

export type IconButtonProps = PropsWithChildren<{
  color?: ThemeTokens | ColorTokens;
  backgroundColorOnPress?: ThemeTokens | ColorTokens;
  radius?: RadiusTokens;
}> &
  ComponentProps<typeof Button.Frame>;

export function IconButton({
  children,
  onPress,
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
  // Clone the icon element and add color prop
  const iconWithColor = isValidElement(children)
    ? cloneElement(children as React.ReactElement, { color })
    : children;

  return (
    <Button.Frame
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
      {iconWithColor}
    </Button.Frame>
  );
}
