import {
  Button,
  Icon,
  Text,
  Pressable as TlonPressable,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { ComponentProps, PropsWithChildren, forwardRef, useState } from 'react';
import { ColorTokens, TamaguiElement, View, XStack, styled } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import {
  type ScreenHeaderAction,
  type ScreenHeaderIconName,
  type ScreenHeaderMenuAction,
  visibleScreenHeaderActions,
} from './actions';

export const HeaderIconButton = styled(Icon, {
  customSize: ['$3xl', '$2xl'],
  borderRadius: '$m',
  cursor: 'pointer',
  pressStyle: {
    opacity: 0.5,
  },
});

/**
 * The React counterpart of the iOS 26 UIBarButtonItem badge, for Android, web
 * and older iOS. A blank value is a dot; anything else is drawn as a count.
 */
export function HeaderIconBadge({
  value,
  color,
  testID,
}: {
  value: number | string;
  color: ColorTokens;
  testID?: string;
}) {
  const label = String(value).trim();
  return (
    <View
      position="absolute"
      top={2}
      right={2}
      minWidth={label ? 16 : 10}
      height={label ? 16 : 10}
      paddingHorizontal={label ? 4 : 0}
      borderRadius={8}
      backgroundColor={color}
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
      testID={testID}
    >
      {label ? (
        <Text size="$label/s" color="$white" numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function HeaderTextButton({
  children,
  color = '$primaryText',
  disabled,
  onPress,
  testID,
}: PropsWithChildren<{
  color?: ColorTokens;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}>) {
  return (
    <TlonPressable
      accessibilityRole="button"
      alignItems="center"
      cursor={disabled ? 'default' : 'pointer'}
      disabled={disabled}
      height="$4xl"
      justifyContent="center"
      onPress={disabled ? undefined : onPress}
      paddingHorizontal="$s"
      paddingTop="$xs"
      testID={testID}
    >
      <Text size="$label/2xl" color={disabled ? '$tertiaryText' : color}>
        {children}
      </Text>
    </TlonPressable>
  );
}

export const HeaderBackButton = ({
  disabled = false,
  onPress,
}: {
  disabled?: boolean;
  onPress?: () => void;
}) => {
  return (
    <HeaderIconButton
      accessible
      accessibilityLabel="Back"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      color={disabled ? '$tertiaryText' : '$primaryText'}
      cursor={disabled ? 'default' : 'pointer'}
      disabled={disabled}
      testID="HeaderBackButton"
      type="ChevronLeft"
      onPress={disabled ? undefined : onPress}
    />
  );
};

export const HeaderTitleText = styled(Text, {
  size: '$label/2xl',
  numberOfLines: 1,
});

export const HeaderControls = styled(XStack, {
  position: 'absolute',
  bottom: 0,
  height: '$4xl',
  alignItems: 'center',
  gap: '$l',
  zIndex: 1,
  variants: {
    side: {
      left: {
        left: '$xl',
      },
      right: {
        right: '$xl',
      },
    },
  } as const,
});

/** React renderer for the shared item model, used by web and Android. */
export function ScreenHeaderItemElements({
  actions,
  nativeHeader = false,
}: {
  actions: ScreenHeaderAction[];
  nativeHeader?: boolean;
}) {
  const visible = visibleScreenHeaderActions(actions);
  if (visible.length === 0) {
    return null;
  }

  return (
    <XStack
      alignItems="center"
      height={nativeHeader ? '$4xl' : undefined}
      gap={nativeHeader ? '$l' : undefined}
    >
      {visible.map((action) => {
        if ('items' in action) {
          return <HeaderItemMenu key={action.id} action={action} />;
        }
        if ('text' in action) {
          return (
            <HeaderTextButton
              key={action.id}
              onPress={action.disabled ? undefined : action.onPress}
              disabled={action.disabled}
              color={(action.tint as ColorTokens) ?? '$primaryText'}
              testID={action.testID ?? action.id}
            >
              {action.text}
            </HeaderTextButton>
          );
        }
        return (
          <View key={action.id} position="relative">
            <HeaderIconButton
              type={action.icon}
              disabled={action.disabled}
              onPress={action.disabled ? undefined : action.onPress}
              color={(action.tint as ColorTokens) ?? '$primaryText'}
              backgroundColor={
                (action.backgroundTint as ColorTokens) ?? 'transparent'
              }
              testID={action.testID ?? action.id}
              aria-label={action.label}
            />
            {action.badge != null && (
              <HeaderIconBadge
                value={action.badge}
                color={(action.tint as ColorTokens) ?? '$blue'}
                testID={`${action.testID ?? action.id}-badge`}
              />
            )}
          </View>
        );
      })}
    </XStack>
  );
}

function HeaderItemMenu({ action }: { action: ScreenHeaderMenuAction }) {
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
          icon={action.icon}
          aria-label={action.label}
          testID={action.testID ?? action.id}
          onPress={isWindowNarrow ? () => setOpen(true) : undefined}
        />
      }
    >
      <ActionSheet.Content>
        <ActionSheet.ActionGroup accent="neutral">
          {action.items.map((item) => (
            <ActionSheet.Action
              key={item.id}
              action={{
                title: item.label,
                accent: item.destructive ? 'negative' : undefined,
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
