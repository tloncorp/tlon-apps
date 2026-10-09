import { Button } from '@tloncorp/ui';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { YStack } from 'tamagui';

import { BrowserControlButton } from './BrowserViewerControls.native';
import type { BrowserViewerMenuProps } from './BrowserViewerMenu.types';

// Android retains the floating menu while iOS uses the system popover.
export function BrowserViewerMenu({
  topInset,
  rightInset,
  mode,
  ready,
  onSelect,
  browserControlsVisible,
  onBrowserControlsChange,
}: BrowserViewerMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? (
        <Pressable
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          accessibilityLabel="Dismiss browser options"
          onPress={() => setOpen(false)}
        />
      ) : null}
      <YStack
        position="absolute"
        top={topInset + 12}
        right={rightInset + 12}
        alignItems="flex-end"
        gap="$s"
      >
        <BrowserControlButton
          icon="Overflow"
          accessibilityLabel="Browser options"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}
        />
        {open ? (
          <YStack
            backgroundColor="$background"
            borderRadius="$l"
            padding="$s"
            gap="$xs"
            shadowColor="$primaryText"
            shadowOpacity={0.12}
            shadowRadius={12}
            shadowOffset={{ width: 0, height: 3 }}
            elevation={4}
            minWidth={180}
          >
            {(['agent', 'mobile'] as const).map((value) => (
              <Button
                key={value}
                accessibilityRole="button"
                preset="secondary"
                label={value === 'agent' ? 'Agent View' : 'Mobile View'}
                accessibilityLabel={
                  value === 'agent' ? 'Agent View' : 'Mobile View'
                }
                trailingIcon={
                  (mode ?? 'agent') === value ? 'Checkmark' : undefined
                }
                accessibilityState={{ selected: (mode ?? 'agent') === value }}
                disabled={!ready}
                onPress={() => {
                  setOpen(false);
                  onSelect(value);
                }}
              />
            ))}
            <Button
              preset="secondary"
              label="Show browser controls"
              accessibilityLabel="Show browser controls"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: browserControlsVisible ?? false }}
              trailingIcon={browserControlsVisible ? 'Checkmark' : undefined}
              disabled={browserControlsVisible === undefined}
              onPress={() => {
                if (browserControlsVisible === undefined) return;
                setOpen(false);
                onBrowserControlsChange(!browserControlsVisible);
              }}
            />
          </YStack>
        ) : null}
      </YStack>
    </>
  );
}
