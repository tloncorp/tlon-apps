import { PropsWithChildren } from 'react';

import { Button } from '../components/Button';
import {
  ColorTokens,
  RadiusTokens,
  SizeTokens,
  ThemeTokens,
  useTheme,
} from '../core';

export function IconButton({
  children,
  onPress,
  size = '$s',
  color = '$primaryText',
  backgroundColor = '$background',
  backgroundColorOnPress = '$secondaryBackground',
  disabled = false,
  radius = '$l',
}: PropsWithChildren<{
  onPress?: () => void;
  size?: SizeTokens;
  color?: ThemeTokens | ColorTokens;
  backgroundColor?: ThemeTokens | ColorTokens;
  backgroundColorOnPress?: ThemeTokens | ColorTokens;
  radius?: RadiusTokens;
  disabled?: boolean;
}>) {
  const theme = useTheme();
  return (
    <Button
      size={size}
      width="$3xl"
      height="$3xl"
      onPress={onPress}
      disabled={disabled}
      borderRadius={radius}
      pressStyle={{
        backgroundColor: theme[backgroundColorOnPress]?.get(),
      }}
      backgroundColor={theme[backgroundColor]?.get()}
      // borderWidth="unset" because otherwise it would be set to 1px
      // and we don't want that for an icon button
      borderWidth="unset"
    >
      <Button.Icon color={theme[color]?.get()}>{children}</Button.Icon>
    </Button>
  );
}
