import { ComponentProps, PropsWithChildren } from 'react';
import { YStack, styled, withStaticProperties } from 'tamagui';

import { ListItem, ListItemFrame } from './ListItem';

const ActionListFrame = styled(YStack, {
  overflow: 'hidden',
  backgroundColor: '$secondaryBackground',
  shadowColor: '$black',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
});

const ActionFrame = styled(ListItemFrame, {
  borderRadius: 'unset',
  borderBottomWidth: 0.5,
  borderBottomColor: '$gray700',
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

export const ActionList = withStaticProperties(ActionListFrame, {
  Action,
});
