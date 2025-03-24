import { PropsWithChildren } from 'react';
import {
  ColorTokens,
  GetThemeValueForKey,
  RadiusTokens,
  SizeTokens,
  ThemeTokens,
  useTheme,
} from 'tamagui';

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
  const theme = useTheme();

  // Process special props
  const resolvedWidth =
    typeof width === 'string' && width.startsWith('$')
      ? theme[width]?.val
      : width;

  return (
    <Button
      size={size}
      onPress={onPress}
      disabled={disabled}
      borderRadius={radius}
      style={style}
      width={resolvedWidth}
      pressStyle={{
        backgroundColor: theme[backgroundColorOnPress]?.get(),
        ...pressStyle,
      }}
      backgroundColor={theme[backgroundColor]?.get()}
      borderWidth={borderWidth}
      {...rest}
    >
      <Button.Icon color={theme[color]?.get()}>{children}</Button.Icon>
    </Button>
  );
}
