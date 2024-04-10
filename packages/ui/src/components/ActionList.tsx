import { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { SizableText, YStack, styled, withStaticProperties } from 'tamagui';

import { ListItem, ListItemFrame } from './ListItem';

const ActionListFrame = styled(YStack, {
  backgroundColor: '$positiveBackground',
  overflow: 'hidden',
  borderRadius: '$m',
});

const ActionFrame = styled(ListItemFrame, {
  borderRadius: 'unset',
  borderBottomWidth: 1,
  borderBottomColor: '$black',
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
