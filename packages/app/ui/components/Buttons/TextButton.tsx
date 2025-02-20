import { Button, ButtonProps } from '../../tmp/components/Button';

export function TextButton({
  onPress,
  children,
  ...props
}: ButtonProps & {
  children: string;
}) {
  return (
    <Button onPress={onPress} minimal {...props}>
      <Button.Text>{children}</Button.Text>
    </Button>
  );
}
