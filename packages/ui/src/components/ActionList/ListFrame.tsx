import { BlurView } from 'expo-blur';
import { ComponentProps, PropsWithChildren } from 'react';
import { YStack, styled } from 'tamagui';

import { ListItemFrame } from '../ListItem';

const ListFrame = styled(YStack, {
  overflow: 'hidden',
  borderRadius: '$m',
});

const ListFrameComponent = (
  props: PropsWithChildren<
    ComponentProps<typeof ListItemFrame> & ComponentProps<typeof BlurView>
  >
) => {
  const { children, intensity, tint, ...rest } = props;
  return (
    <ListFrame {...rest}>
      <BlurView
        style={{ flex: 1 }}
        intensity={intensity ?? 80}
        tint={tint ?? 'extraLight'}
      >
        {children}
      </BlurView>
    </ListFrame>
  );
};

export default ListFrameComponent;
