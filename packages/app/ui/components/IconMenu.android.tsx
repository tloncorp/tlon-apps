import {
  DropdownMenu,
  DropdownMenuItem,
  Host,
  RNHostView,
  Text,
} from '@expo/ui/jetpack-compose';
import { Pressable } from '@tloncorp/ui';
import { useState } from 'react';

import type { IconMenuProps } from './IconMenu.types';

/** Opens a Material menu of what can be done to an image, from any content. */
export function IconMenu({
  children,
  items,
  accessibilityLabel,
  testID,
}: IconMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Host matchContents>
      <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <Pressable
              onPress={() => setOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              testID={testID}
            >
              {children}
            </Pressable>
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {items.map((item) => (
            <DropdownMenuItem
              key={item.key}
              onClick={() => {
                setOpen(false);
                item.onPress();
              }}
            >
              <DropdownMenuItem.Text>
                <Text>{item.title}</Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
