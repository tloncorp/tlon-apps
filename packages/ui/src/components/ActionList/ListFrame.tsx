import { BlurView } from 'expo-blur';
import { ComponentProps, PropsWithChildren } from 'react';
import { YStack, styled } from 'tamagui';

import useIsWindowNarrow from '../../hooks/useIsWindowNarrow';
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
  const isWindowNarrow = useIsWindowNarrow();

  if (!isWindowNarrow) {
    // Blur view adds a shadow, we don't want that in the modal that's
    // rendered on desktop
    return <ListFrame {...rest}>{children}</ListFrame>;
  }

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
