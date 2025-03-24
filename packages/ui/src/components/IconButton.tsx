import { PropsWithChildren } from 'react';
import {
  ColorTokens,
  RadiusTokens,
  SizeTokens,
  ThemeTokens,
  useTheme,
} from 'tamagui';

import { Button } from './Button';

export type IconButtonProps = {
  children: React.ReactNode;
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
  width?: SizeTokens | string;
};

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
}: IconButtonProps) {
  const theme = useTheme();
  return (
    <Button
      size={size}
      onPress={onPress}
      disabled={disabled}
      borderRadius={radius}
      style={style}
      width={width}
      pressStyle={{
        backgroundColor: theme[backgroundColorOnPress]?.get(),
        ...pressStyle,
      }}
      backgroundColor={theme[backgroundColor]?.get()}
      // borderWidth="unset" because otherwise it would be set to 1px
      // and we don't want that for an icon button
      borderWidth={borderWidth}
    >
      <Button.Icon color={theme[color]?.get()}>{children}</Button.Icon>
    </Button>
  );
}
