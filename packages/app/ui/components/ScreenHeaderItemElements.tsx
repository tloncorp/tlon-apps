import { Button, Icon, useIsWindowNarrow } from '@tloncorp/ui';
import { ComponentProps, forwardRef, useState } from 'react';
import { ColorTokens, TamaguiElement, XStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { HeaderIconButton, HeaderTextButton } from './ScreenHeaderPrimitives';
import {
  type HeaderMenuItemConfig,
  type ScreenHeaderIconName,
  type ScreenHeaderItemConfig,
  visibleHeaderItemConfigs,
} from './screenHeaderItemModel';

/** React renderer for the shared item model, used by web and Android. */
export function ScreenHeaderItemElements({
  configs,
  nativeHeader = false,
}: {
  configs: ScreenHeaderItemConfig[];
  nativeHeader?: boolean;
}) {
  const visible = visibleHeaderItemConfigs(configs);
  if (visible.length === 0) {
    return null;
  }

  return (
    <XStack
      alignItems="center"
      height={nativeHeader ? '$4xl' : undefined}
      gap={nativeHeader ? '$l' : undefined}
    >
      {visible.map((config) => {
        if ('menu' in config) {
          return <HeaderItemMenu key={config.id} config={config} />;
        }
        if ('text' in config) {
          return (
            <HeaderTextButton
              key={config.id}
              onPress={config.disabled ? undefined : config.onPress}
              disabled={config.disabled}
              color={(config.tint as ColorTokens) ?? '$primaryText'}
              testID={config.testID ?? config.id}
            >
              {config.text}
            </HeaderTextButton>
          );
        }
        return (
          <HeaderIconButton
            key={config.id}
            type={config.icon}
            disabled={config.disabled}
            onPress={config.disabled ? undefined : config.onPress}
            color={(config.tint as ColorTokens) ?? '$primaryText'}
            backgroundColor={
              (config.backgroundTint as ColorTokens) ?? 'transparent'
            }
            testID={config.testID ?? config.id}
            aria-label={config.label}
          />
        );
      })}
    </XStack>
  );
}

function HeaderItemMenu({ config }: { config: HeaderMenuItemConfig }) {
  const [open, setOpen] = useState(false);
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <ActionSheet
      mode={isWindowNarrow ? 'sheet' : 'popover'}
      modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <HeaderItemMenuTrigger
          icon={config.menu.icon}
          aria-label={config.menu.label}
          onPress={isWindowNarrow ? () => setOpen(true) : undefined}
        />
      }
    >
      <ActionSheet.Content>
        <ActionSheet.ActionGroup accent="neutral">
          {config.menu.items.map((item) => (
            <ActionSheet.Action
              key={item.label}
              action={{
                title: item.label,
                action: () => {
                  setOpen(false);
                  item.onPress();
                },
              }}
            />
          ))}
        </ActionSheet.ActionGroup>
      </ActionSheet.Content>
    </ActionSheet>
  );
}

const HeaderItemMenuTrigger = forwardRef<
  TamaguiElement,
  ComponentProps<typeof Button.Frame> & { icon: ScreenHeaderIconName }
>(function HeaderItemMenuTrigger({ icon, ...props }, ref) {
  return (
    <Button.Frame ref={ref} fill="text" intent="secondary" {...props}>
      <Icon type={icon} color="$secondaryText" />
    </Button.Frame>
  );
});
