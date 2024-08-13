import {
  Children,
  ComponentProps,
  Fragment,
  PropsWithChildren,
  useCallback,
  useRef,
  useState,
} from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SheetProps,
  Text,
  View,
  YStack,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { Icon, IconType } from './Icon';
import { ListItem } from './ListItem';
import { Sheet } from './Sheet';

export type Action = {
  title: string;
  description?: string;
  action?: () => void;
  icon?: IconType;
};

export type ActionGroup = {
  accent: 'positive' | 'negative' | 'neutral';
  actions: Action[];
};

const ActionSheetActionGroupContext = createStyledContext<{
  accent: 'positive' | 'negative' | 'neutral';
}>({
  accent: 'neutral',
});

type ActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ActionSheetHeaderFrame = styled(View, {
  name: 'ActionSheetHeader',
  paddingHorizontal: '$xl',
});

const ActionSheetHeader = ActionSheetHeaderFrame.styleable(
  ({ children, ...props }, ref) => {
    return (
      <ActionSheetHeaderFrame {...props} ref={ref}>
        <ListItem pressable={false} paddingHorizontal="$2xl">
          {children}
        </ListItem>
      </ActionSheetHeaderFrame>
    );
  }
);

/**
 * Convenience wrapper for rendering default-style actions
 */
export const ActionSheetActionGroupList = ({
  actionGroups,
}: {
  actionGroups: ActionGroup[];
}) => {
  return actionGroups.map((group, i) => {
    return (
      <ActionSheet.ActionGroup key={i} accent={group.accent}>
        {group.actions.map((action, index) => (
          <ActionSheet.Action key={index} action={action} />
        ))}
      </ActionSheet.ActionGroup>
    );
  });
};

const ActionSheetActionGroupFrame = styled(View, {
  name: 'ActionSheetActionGroupFrame',
  context: ActionSheetActionGroupContext,
  padding: '$xl',
  variants: {
    accent: {
      positive: {
        borderColor: '$positiveBorder',
      },
      negative: {
        borderColor: '$negativeBorder',
      },
      neutral: {
        borderColor: '$border',
      },
    },
  } as const,
});

const ActionSheetActionGroupContent = styled(YStack, {
  context: ActionSheetActionGroupContext,
  borderRadius: '$xl',
  borderWidth: 1,
  borderColor: '$border',
  overflow: 'hidden',
  variants: {
    accent: {
      positive: {
        borderColor: '$positiveBorder',
      },
      negative: {
        borderColor: '$negativeBorder',
      },
      neutral: {
        borderColor: '$border',
      },
    },
  } as const,
});

const ActionSheetActionGroup = ActionSheetActionGroupFrame.styleable(
  (props, ref) => {
    const actions = Children.toArray(props.children);
    return (
      <ActionSheetActionGroupFrame {...props} ref={ref}>
        <ActionSheetActionGroupContent>
          {actions.map((c, index) => (
            <Fragment key={index}>
              {c}
              {index < actions.length - 1 && (
                <ActionSheetActionGroupSeparator key={'separator-' + index} />
              )}
            </Fragment>
          ))}
        </ActionSheetActionGroupContent>
      </ActionSheetActionGroupFrame>
    );
  }
);

const ActionSheetActionGroupSeparator = styled(View, {
  name: 'ActionSheetActionGroupSeparator',
  height: 1,
  backgroundColor: '$border',
  width: '100%',
});

const ActionSheetActionFrame = styled(ListItem, {
  name: 'ActionSheetActionFrame',
  context: ActionSheetActionGroupContext,
  borderRadius: 0,
  paddingHorizontal: '$2xl',
  pressStyle: {
    backgroundColor: '$secondaryBackground',
  },
  variants: {
    type: {
      positive: {
        pressStyle: {
          backgroundColor: '$positiveBackground',
        },
      },
      negative: {
        pressStyle: {
          backgroundColor: '$negativeBackground',
        },
      },
      neutral: {},
    },
  } as const,
});

const ActionSheetActionTitle = styled(ListItem.Title, {
  context: ActionSheetActionGroupContext,
  variants: {
    accent: {
      positive: {
        color: '$positiveActionText',
      },
      negative: {
        color: '$negativeActionText',
      },
      neutral: {},
    },
  } as const,
});

const ActionSheetActionDescription = styled(ListItem.Subtitle, {
  context: ActionSheetActionGroupContext,
  variants: {
    accent: {
      positive: {
        color: '$positiveActionText',
      },
      negative: {
        color: '$negativeActionText',
      },
      neutral: {},
    },
  } as const,
});

function ActionSheetAction({
  action,
  ...props
}: ComponentProps<typeof ActionSheetActionFrame> & {
  action: Action;
}) {
  return (
    <ActionSheetActionFrame {...props} onPress={action.action}>
      <ListItem.MainContent>
        <ActionSheet.ActionTitle>{action.title}</ActionSheet.ActionTitle>
        {action.description && (
          <ActionSheet.ActionDescription>
            {action.description}
          </ActionSheet.ActionDescription>
        )}
      </ListItem.MainContent>
      <ListItem.EndContent>
        {action.icon && <ActionSheetActionIcon type={action.icon} />}
      </ListItem.EndContent>
    </ActionSheetActionFrame>
  );
}

const ActionSheetActionIcon = styled(Icon, {
  context: ActionSheetActionGroupContext,
  size: '$m',
  variants: {
    accent: {
      positive: {
        color: '$positiveActionText',
      },
      negative: {
        color: '$negativeActionText',
      },
      neutral: {},
    },
  } as const,
});

const ActionSheetFrameComponent = ({
  open,
  onOpenChange,
  children,
  ...props
}: PropsWithChildren<ActionSheetProps & SheetProps>) => {
  const hasOpened = useRef(open);
  if (!hasOpened.current && open) {
    hasOpened.current = true;
  }

  if (!hasOpened.current) return null;

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
      <Sheet.Frame>
        <Sheet.Handle />
        {children}
      </Sheet.Frame>
    </Sheet>
  );
};

const ActionSheetScrollViewFrame = styled(View, {
  flex: 1,
  borderTopWidth: 1,
  borderColor: 'transparent',
  variants: {
    scrolling: {
      true: {
        borderColor: '$border',
      },
    },
  },
});

const ActionSheetScrollView = ({
  onScroll,
  ...props
}: ComponentProps<typeof Sheet.ScrollView>) => {
  const [isScrolling, setIsScrolling] = useState(false);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isScrolling && e.nativeEvent.contentOffset.y === 0) {
        setIsScrolling(false);
      } else if (!isScrolling && e.nativeEvent.contentOffset.y > 0) {
        setIsScrolling(true);
      }
      onScroll?.(e);
    },
    [onScroll, isScrolling]
  );
  const insets = useSafeAreaInsets();
  return (
    <ActionSheetScrollViewFrame scrolling={isScrolling}>
      <Sheet.ScrollView
        flex={1}
        {...props}
        onScroll={handleScroll}
        overflow="hidden"
        alwaysBounceVertical={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        scrollIndicatorInsets={{ top: 0, bottom: insets.bottom + 24 }}
      />
    </ActionSheetScrollViewFrame>
  );
};

export const ActionSheet = withStaticProperties(ActionSheetFrameComponent, {
  Action: ActionSheetAction,
  Header: ActionSheetHeader,
  ActionTitle: ActionSheetActionTitle,
  ActionDescription: ActionSheetActionDescription,
  ActionGroup: ActionSheetActionGroup,
  ActionGroupList: ActionSheetActionGroupList,
  ScrollView: ActionSheetScrollView,
});
