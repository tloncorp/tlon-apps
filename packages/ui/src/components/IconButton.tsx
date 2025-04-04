import { PropsWithChildren } from 'react';
import { ColorTokens, RadiusTokens, SizeTokens, ThemeTokens } from 'tamagui';

import { Button } from './Button';

export type IconButtonProps = PropsWithChildren<{
  onPress?: () => void;
  size?: SizeTokens;
  color?: ThemeTokens | ColorTokens;
  backgroundColor?: ThemeTokens | ColorTokens | 'unset';
  backgroundColorOnPress?: ThemeTokens | ColorTokens;
  radius?: RadiusTokens;
  disabled?: boolean;
  style?: any;
  pressStyle?: any;
  borderWidth?: any;
  width?: SizeTokens | string | number;
  [key: string]: any;
}>;

export function IconButton({
  children,
  onPress,
  size = '$s',
  color = '$primaryText',
  backgroundColor = '$background',
  backgroundColorOnPress = '$secondaryBackground',
  disabled = false,
  radius = '$l',
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
