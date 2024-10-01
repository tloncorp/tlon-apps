import { ComponentProps, PropsWithChildren } from 'react';
import { styled, withStaticProperties } from 'tamagui';

import { ListItem, ListItemFrame } from '../ListItem';
import ListFrame from './ListFrame';

const ActionFrame = styled(ListItemFrame, {
  borderRadius: 'unset',
  borderBottomWidth: 0.5,
  borderBottomColor: '$secondaryBorder',
  backgroundColor: 'transparent',
  pressStyle: {
    backgroundColor: '$secondaryBorder',
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
    disabled?: boolean;
  }
) {
  const { children, actionType, disabled, ...rest } = props;

  const textColor = disabled
    ? '$secondaryText'
    : actionType === 'destructive'
      ? '$red'
      : undefined;

  return (
    <ActionFrame {...rest}>
      <ListItem.Title color={textColor}>{children}</ListItem.Title>
    </ActionFrame>
  );
}

const ActionList = withStaticProperties(ListFrame, {
  Action,
});

export default ActionList;
