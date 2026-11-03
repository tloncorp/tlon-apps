// iOS only: the SwiftUI menus in the settings list and the icon menu import
// this, so no other platform loads it.
import { Button } from '@expo/ui/swift-ui';
import type { ComponentProps } from 'react';

import type { SettingsMenuItem } from './types';

/** A native menu's commands, each with its symbol, destructive ones in red. */
export function SwiftUIMenuItems({ items }: { items: SettingsMenuItem[] }) {
  return items.map((item) => (
    <Button
      key={item.key}
      label={item.title}
      systemImage={
        item.systemImage as ComponentProps<typeof Button>['systemImage']
      }
      role={item.destructive ? 'destructive' : undefined}
      onPress={item.onPress}
    />
  ));
}
