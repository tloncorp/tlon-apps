import * as Haptics from 'expo-haptics';
import { ComponentProps, PropsWithChildren } from 'react';
import {
  SheetProps,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { Stack, Text, View } from '../core';
import Pressable from './Pressable';
import { Sheet } from './Sheet';

const ActionSheetActionContext = createStyledContext<{
  success?: boolean;
  primary?: boolean;
  destructive?: boolean;
  default?: boolean;
}>({
  default: true,
  success: false,
  primary: false,
  destructive: false,
});

type ActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ActionSheetFrame = styled(View, {
  gap: '$xl',
  paddingHorizontal: '$2xl',
  paddingTop: '$xl',
  paddingBottom: '$4xl',
});

const ActionSheetHeader = styled(Stack, {
  paddingBottom: '$m',
  flexDirection: 'column',
});

const ActionSheetActionFrame = styled(Stack, {
  context: ActionSheetActionContext,
  padding: '$l',
  borderWidth: 1,
  borderRadius: '$l',
  pressStyle: {
    backgroundColor: '$positiveBackground',
  },
  variants: {
    default: {
      true: {
        backgroundColor: '$background',
        borderColor: '$tertiaryText',
      },
    },
    success: {
      true: {
        backgroundColor: '$greenSoft',
        borderColor: '$green',
      },
    },
    primary: {
      true: {
        backgroundColor: '$blueSoft',
        borderColor: '$blue',
      },
    },
    destructive: {
      true: {
        backgroundColor: '$redSoft',
        borderColor: '$red',
      },
    },
  } as const,
});

const ActionSheetTitle = styled(Text, {
  fontSize: '$l',
  fontWeight: '500',
});

const ActionSheetDescription = styled(Text, {
  fontSize: '$l',
  color: '$secondaryText',
});

const ActionSheetActionTitle = styled(Text, {
  context: ActionSheetActionContext,
  fontSize: '$l',
  fontWeight: '500',
  variants: {
    default: {
      true: {
        color: '$primaryText',
      },
    },
    success: {
      true: {
        color: '$green',
      },
    },
    primary: {
      true: {
        color: '$blue',
      },
    },
    destructive: {
      true: {
        color: '$red',
      },
    },
  } as const,
});

const ActionSheetActionDescription = styled(Text, {
  color: '$secondaryText',
  fontSize: '$s',
});

function ActionSheetAction({
  children,
  action,
  ...props
}: PropsWithChildren<ComponentProps<typeof ActionSheetActionFrame>> & {
  action: () => void;
}) {
  return (
    <Pressable
      onPress={async () => {
        await Haptics.selectionAsync();
        action();
      }}
    >
      <ActionSheetActionFrame onPress={action} {...props}>
        {children}
      </ActionSheetActionFrame>
    </Pressable>
  );
}

const ActionSheetFrameComponent = ({
  open,
  onOpenChange,
  children,
  ...props
}: PropsWithChildren<ActionSheetProps & SheetProps>) => {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPointsMode="fit"
      animation="quick"
      {...props}
    >
      <Sheet.Overlay animation="quick" />
      <Sheet.LazyFrame>
        <Sheet.Handle paddingTop="$xl" />
        <ActionSheetFrame>{children}</ActionSheetFrame>
      </Sheet.LazyFrame>
    </Sheet>
  );
};

export const ActionSheet = withStaticProperties(ActionSheetFrameComponent, {
  Action: ActionSheetAction,
  Header: ActionSheetHeader,
  Title: ActionSheetTitle,
  Description: ActionSheetDescription,
  ActionTitle: ActionSheetActionTitle,
  ActionDescription: ActionSheetActionDescription,
});
