import { Button, ButtonProps } from '@tloncorp/ui';
import { ComponentProps } from 'react';

export function TextButton({
  onPress,
  children,
  textProps,
  ...props
}: ButtonProps & {
  textProps?: ComponentProps<typeof Button.Text>;
  children: string;
}) {
  return (
    <Button onPress={onPress} minimal {...props}>
      <Button.Text {...textProps}>{children}</Button.Text>
    </Button>
  );
}
