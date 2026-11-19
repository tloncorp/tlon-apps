// iOS only: the SwiftUI menus in the settings list and the icon menu import
// this, so no other platform loads it.
import { Button, Divider } from '@expo/ui/swift-ui';
import { type ComponentProps, Fragment } from 'react';

import type { SettingsMenuItem } from './types';

/**
 * A native menu's commands, each with its symbol, destructive ones in red,
 * and a divider above any that starts a new group.
 */
export function SwiftUIMenuItems({
  items,
}: {
  items: (SettingsMenuItem & { separatorBefore?: boolean })[];
}) {
  return items.map((item) => (
    <Fragment key={item.key}>
      {item.separatorBefore ? <Divider /> : null}
      <Button
        label={item.title}
        systemImage={
          item.systemImage as ComponentProps<typeof Button>['systemImage']
        }
        role={item.destructive ? 'destructive' : undefined}
        onPress={item.onPress}
      />
    </Fragment>
  ));
}
