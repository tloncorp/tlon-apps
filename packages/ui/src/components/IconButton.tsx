import { SizeTokens } from 'tamagui';

import { Button } from '../components/Button';

export function IconButton({
  children,
  onPress,
  size = '$s',
}: {
  children: React.ReactNode;
  onPress: () => void;
  size?: SizeTokens;
}) {
  return (
    <Button size={size} onPress={onPress} borderWidth="unset">
      <Button.Icon>{children}</Button.Icon>
    </Button>
  );
}
