import * as db from '@tloncorp/shared/dist/db';
import { XStack } from 'tamagui';

import { Icon } from '../Icon';

export const ChatMessageDeliveryStatus = XStack.styleable<{
  status: db.PostDeliveryStatus;
}>(({ status, ...props }, ref) => {
  return (
    <XStack gap={-10} {...props} ref={ref}>
      <Icon
        type="ChevronRight"
        color={status === 'pending' ? '$tertiaryText' : '$primaryText'}
        customSize={[16, 16]}
      />
      <Icon type="ChevronRight" customSize={[16, 16]} />
    </XStack>
  );
});
