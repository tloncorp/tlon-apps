import { Button, ButtonProps } from '@tloncorp/ui';
import { ComponentProps } from 'react';

export function TextButton({
  onPress,
  children,
  textProps,
  ...props
}: Omit<ButtonProps, 'label'> & {
  textProps?: ComponentProps<typeof Button.Text>;
  children: string;
}) {
  return (
    <Button fill="text" type="primary" onPress={onPress} label={children} {...props} />
  );
}
