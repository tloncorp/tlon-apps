import {
  Button,
  Icon,
  Text,
  Pressable as TlonPressable,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { ComponentProps, PropsWithChildren, forwardRef, useState } from 'react';
import { ColorTokens, TamaguiElement, XStack, styled } from 'tamagui';

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

export const HeaderBackButton = ({ onPress }: { onPress?: () => void }) => {
  return (
    <HeaderIconButton
      testID="HeaderBackButton"
      type="ChevronLeft"
      onPress={onPress}
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
          <HeaderIconButton
            key={action.id}
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
