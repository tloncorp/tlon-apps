import { ComponentProps, PropsWithChildren } from 'react';
import { styled, withStaticProperties } from 'tamagui';

import { ListItem, ListItemFrame } from '../ListItem';
import ListFrame from './ListFrame';

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

const ActionList = withStaticProperties(ListFrame, {
  Action,
});

export default ActionList;
