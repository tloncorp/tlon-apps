import { PropsWithChildren } from 'react';
import { Popover, withStaticProperties } from 'tamagui';

import ActionList from './ActionList';

export const ActionMenu = withStaticProperties(Popover, {
  ...Popover,
  Content: ActionMenuContent,
  Action: ActionList.Action,
});

export function ActionMenuContent({ children }: PropsWithChildren) {
  return (
    <Popover.Content>
      <ActionList>{children}</ActionList>
    </Popover.Content>
  );
}
