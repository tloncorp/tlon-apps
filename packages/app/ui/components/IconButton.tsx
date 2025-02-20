import { PropsWithChildren } from 'react';
import {
  ColorTokens,
  RadiusTokens,
  SizeTokens,
  ThemeTokens,
  useTheme,
} from 'tamagui';

import { Button, ButtonProps } from '../components/Button';

export function IconButton({
  children,
  onPress,
  size = '$s',
  color = '$primaryText',
  backgroundColor = '$background',
  backgroundColorOnPress = '$secondaryBackground',
  disabled = false,
  radius = '$l',
  ...rest
}: PropsWithChildren<
  {
    onPress?: () => void;
    size?: SizeTokens;
    color?: ThemeTokens | ColorTokens;
    backgroundColor?: ThemeTokens | ColorTokens | 'unset';
    backgroundColorOnPress?: ThemeTokens | ColorTokens;
    radius?: RadiusTokens;
    disabled?: boolean;
  } & ButtonProps
>) {
  const theme = useTheme();
  return (
    <Button
      size={size}
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
      {...rest}
    >
      <Button.Icon color={theme[color]?.get()}>{children}</Button.Icon>
    </Button>
  );
}
