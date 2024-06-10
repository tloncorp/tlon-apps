import { ComponentProps } from 'react';

import { Circle } from '../core';

export function UnreadDot(
  props: ComponentProps<typeof Circle> & { color?: 'primary' | 'neutral' }
) {
  return (
    <Circle
      size="$m"
      backgroundColor={
        props.color === 'neutral' ? '$gray300' : '$positiveActionText'
      }
      {...props}
    />
  );
}
