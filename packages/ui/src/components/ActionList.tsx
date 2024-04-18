import { BlurView } from 'expo-blur';
import { ComponentProps, PropsWithChildren } from 'react';
import { YStack, styled, withStaticProperties } from 'tamagui';

import { ListItem, ListItemFrame } from './ListItem';

const ActionListFrame = styled(YStack, {
  overflow: 'hidden',
  borderRadius: '$m',
});

const ActionFrameComponent = (
  props: PropsWithChildren<
    ComponentProps<typeof ActionFrame> & ComponentProps<typeof BlurView>
  >
) => {
  const { children, intensity, tint, ...rest } = props;
  return (
    <ActionListFrame {...rest}>
      <BlurView
        style={{ flex: 1 }}
        intensity={intensity ?? 80}
        tint={tint ?? 'extraLight'}
      >
        {children}
      </BlurView>
    </ActionListFrame>
  );
};

const ActionFrame = styled(ListItemFrame, {
  borderRadius: 'unset',
  borderBottomWidth: 0.5,
  borderBottomColor: '$gray200',
  backgroundColor: 'transparent',
  pressStyle: {
    backgroundColor: '$gray200',
  },
  variants: {
    last: {
      true: {
        borderBottomWidth: 0,
      },
    },
  } as const,
});

function Action(
  props: PropsWithChildren<ComponentProps<typeof ActionFrame>> & {
    actionType?: 'destructive';
  }
) {
  const { children, actionType, ...rest } = props;
  return (
    <ActionFrame {...rest}>
      <ListItem.Title color={actionType === 'destructive' ? '$red' : undefined}>
        {children}
      </ListItem.Title>
    </ActionFrame>
  );
}

export const ActionList = withStaticProperties(ActionFrameComponent, {
  Action,
});
