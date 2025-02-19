import * as db from '@tloncorp/shared/db';
import { XStack } from 'tamagui';

import { Icon } from '../Icon';

export const ChatMessageDeliveryStatus = XStack.styleable<{
  status: db.PostDeliveryStatus;
}>(({ status, ...props }, ref) => {
  return (
    <XStack 
      position="relative"
      width={24}
      height={24}
      ref={ref}
      padding={'$l'}
      backgroundColor={'$shadow'}
      borderRadius={'$xs'}
      {...props} 
    >
      <Icon
        position="absolute"
        left={2}
        top={4}
        type="ChevronRight"
        color={status === 'pending' ? '$tertiaryText' : '$primaryText'}
        customSize={[16, 16]}
      />
      <Icon 
        position="absolute"
        left={8}
        top={4}
        type="ChevronRight" 
        customSize={[16, 16]} 
      />
    </XStack>
  );
});
3