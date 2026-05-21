import { ComponentProps } from 'react';
import { Circle } from 'tamagui';

import { getAndroidRoundedBackgroundKey } from '../utils';

export function UnreadDot(
  props: ComponentProps<typeof Circle> & { color?: 'primary' | 'neutral' }
) {
  const backgroundColor =
    props.backgroundColor ??
    (props.color === 'neutral' ? '$neutralUnreadDot' : '$positiveActionText');

  return (
    <Circle
      key={getAndroidRoundedBackgroundKey(backgroundColor)}
      size="$m"
      backgroundColor={backgroundColor}
      {...props}
    />
  );
}
