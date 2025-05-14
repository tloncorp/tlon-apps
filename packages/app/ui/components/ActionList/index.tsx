import { ComponentProps, PropsWithChildren } from 'react';
import { styled, withStaticProperties } from 'tamagui';

import { ListItem } from '../ListItem/ListItem';
import ListFrame from './ListFrame';

const ActionFrame = styled(ListItem, {
  borderRadius: 'unset',
  borderBottomWidth: 0.5,
  borderBottomColor: '$border',
  backgroundColor: 'transparent',
  hoverStyle: {
    backgroundColor: '$secondaryBackground',
  },
  pressStyle: {
    backgroundColor: '$border',
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
      ? '$negativeActionText'
      : '$primaryText';

  return (
    <ActionFrame cursor="pointer" userSelect="none" {...rest}>
      <ListItem.Title color={textColor}>{children}</ListItem.Title>
    </ActionFrame>
  );
}

const ActionList = withStaticProperties(ListFrame, {
  Action,
});

export default ActionList;
