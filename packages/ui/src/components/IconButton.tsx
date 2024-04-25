import { Button } from '../components/Button';
import { SizeTokens, ThemeTokens, useTheme } from '../core';

export function IconButton({
  children,
  onPress,
  size = '$s',
  color = '$primaryText',
  disabled = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: SizeTokens;
  color?: ThemeTokens;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Button
      size={size}
      width="$3xl"
      height="$3xl"
      onPress={onPress}
      disabled={disabled}
      // borderWidth="unset" because otherwise it would be set to 1px
      // and we don't want that for an icon button
      borderWidth="unset"
    >
      <Button.Icon color={theme[color]?.get()}>{children}</Button.Icon>
    </Button>
  );
}
