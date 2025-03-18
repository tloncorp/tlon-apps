import { ComponentProps } from 'react';
import { Circle } from 'tamagui';

export function UnreadDot(
  props: ComponentProps<typeof Circle> & { color?: 'primary' | 'neutral' }
) {
  return (
    <Circle
      size="$m"
      backgroundColor={
        props.color === 'neutral' ? '$neutralUnreadDot' : '$positiveActionText'
      }
      {...props}
    />
  );
}
