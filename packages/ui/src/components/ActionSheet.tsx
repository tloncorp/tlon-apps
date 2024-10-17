import {
  Children,
  ComponentProps,
  Fragment,
  PropsWithChildren,
  ReactElement,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SheetProps,
  View,
  YStack,
  createStyledContext,
  getTokenValue,
  styled,
  withStaticProperties,
} from 'tamagui';

import { useCopy } from '../hooks/useCopy';
import { Icon, IconType } from './Icon';
import { ListItem } from './ListItem';
import { Sheet } from './Sheet';

export type Accent = 'positive' | 'negative' | 'neutral' | 'disabled';

export type Action = {
  title: string;
  description?: string;
  action?: () => void;
  disabled?: boolean;
  render?: (props: ActionRenderProps) => ReactElement;
  endIcon?: IconType | ReactElement;
  startIcon?: IconType | ReactElement;
  accent?: Accent;
};

export type ActionRenderProps = {
  action: Action;
};

export type ActionGroup = {
  accent: Accent;
  actions: Action[];
};

export type CreateActionInput = Action | false | null | undefined;
export type CreateActionGroupsInput =
  | [Accent, ...CreateActionInput[]]
  | false
  | null
  | undefined;

export function createActionGroups(
  ...inputs: CreateActionGroupsInput[]
): ActionGroup[] {
  return inputs
    .filter((input): input is [Accent, ...CreateActionInput[]] => !!input)
    .map(([accent, ...actions]) => createActionGroup(accent, ...actions));
}

export function createActionGroup(
  accent: Accent,
  ...actions: CreateActionInput[]
): ActionGroup {
  return { accent, actions: actions.filter((a): a is Action => !!a) };
}

type ActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Main component

const ActionSheetComponent = ({
  open,
  onOpenChange,
  children,
  ...props
}: PropsWithChildren<ActionSheetProps & SheetProps>) => {
  const hasOpened = useRef(open);
  if (!hasOpened.current && open) {
    hasOpened.current = true;
  }

  // Sheets are heavy; we don't want to render until we need to
  if (!hasOpened.current) return null;

  return (
    <Modal
      visible={open}
      onRequestClose={() => onOpenChange(false)}
      transparent
      animationType="none"
    >
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        dismissOnSnapToBottom
        snapPointsMode="fit"
        animation="quick"
        handleDisableScroll
        {...props}
      >
        <Sheet.Overlay animation="quick" />
        {/* 
          press style is set here to ensure touch responders are added and drag gestures
          bubble up accordingly (unclear why needed after adding modal wrapper)
        */}
        <Sheet.Frame pressStyle={{}}>
          <Sheet.Handle />
          {children}
        </Sheet.Frame>
      </Sheet>
    </Modal>
  );
};

// Header

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

// Content wrappers

const ActionSheetContent = YStack.styleable((props, ref) => {
  const contentStyle = useContentStyle();
  return <YStack {...contentStyle} {...props} ref={ref} />;
});

const ActionSheetScrollableContent = ({
  ...props
}: ComponentProps<typeof Sheet.ScrollView>) => {
  const contentStyle = useContentStyle();
  return (
    <Sheet.ScrollView
      flex={1}
      overflow="hidden"
      alwaysBounceVertical={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      contentContainerStyle={contentStyle}
      scrollIndicatorInsets={{
        top: 0,
        bottom: contentStyle.paddingBottom,
      }}
      {...props}
    />
  );
};

const useContentStyle = () => {
  const insets = useSafeAreaInsets();
  return {
    paddingBottom: insets.bottom + getTokenValue('$2xl', 'size'),
  };
};

// Content blocks

/**
 * Generic content block
 */
const ActionSheetContentBlock = styled(View, {
  name: 'ActionSheetContentBlock',
  padding: '$xl',
  variants: {
    form: {
      true: { paddingHorizontal: '$2xl' },
      firstBlock: {
        paddingHorizontal: '$2xl',
        paddingTop: 0,
      },
    },
  } as const,
});

const ActionSheetFormBlock = styled(ActionSheetContentBlock, {
  paddingHorizontal: '$2xl',
});

// Action groups

/**
 * Action group content is tinted depending on the type action.
 * We use this context to pass the accent type down to the child components.
 */
const ActionSheetActionGroupContext = createStyledContext<{
  accent: Accent;
}>({
  accent: 'neutral',
});

const ActionSheetActionGroupFrame = styled(ActionSheetContentBlock, {
  name: 'ActionSheetActionGroupFrame',
  context: ActionSheetActionGroupContext,
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
      disabled: {
        borderColor: '$secondaryBorder',
      },
    },
  } as const,
});

/**
 * Render children, adding separator lines between them.
 */
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

const ActionSheetActionGroupContent = styled(YStack, {
  name: 'ActionSheetActionGroupContent',
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
      disabled: {
        borderColor: '$secondaryBorder',
      },
    },
  } as const,
});

// Single action row

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
        backgroundColor: '$positiveBackground',
        pressStyle: {
          backgroundColor: '$positiveBackground',
        },
      },
      negative: {
        backgroundColor: '$negativeBackground',
        pressStyle: {
          backgroundColor: '$negativeBackground',
        },
      },
      neutral: {},
      disabled: {},
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
      disabled: {
        color: '$tertiaryText',
      },
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

function ActionSheetAction({ action }: { action: Action }) {
  const accent = useContext(ActionSheetActionGroupContext).accent;
  return action.render ? (
    action.render({ action })
  ) : (
    <ActionSheetActionFrame
      type={action.accent ?? (accent as Accent)}
      onPress={accent !== 'disabled' ? action.action : undefined}
    >
      {action.startIcon &&
        resolveIcon(action.startIcon, action.accent ?? accent)}
      <ListItem.MainContent>
        <ActionSheet.ActionTitle accent={action.accent ?? accent}>
          {action.title}
        </ActionSheet.ActionTitle>
        {action.description && (
          <ActionSheet.ActionDescription>
            {action.description}
          </ActionSheet.ActionDescription>
        )}
      </ListItem.MainContent>
      {action.endIcon && (
        <ListItem.EndContent>
          {resolveIcon(action.endIcon, action.accent ?? accent)}
        </ListItem.EndContent>
      )}
    </ActionSheetActionFrame>
  );
}

function resolveIcon(icon: IconType | ReactElement, accent: Accent) {
  if (typeof icon === 'string') {
    return <ActionSheetActionIcon accent={accent} type={icon} />;
  }
  return icon;
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
      disabled: {
        color: '$tertiaryText',
      },
    },
  } as const,
});

// Higher-level prefabs

export const SimpleActionSheetHeader = ({
  title,
  subtitle,
  icon,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactElement;
}) => {
  return (
    <ActionSheet.Header>
      {icon ? icon : null}
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
        {subtitle && <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>}
      </ListItem.MainContent>
    </ActionSheet.Header>
  );
};

export const SimpleActionSheet = ({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  actions,
  accent,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactElement;
  actions: Action[];
  accent?: Accent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      {title || subtitle ? (
        <SimpleActionSheetHeader
          title={title}
          subtitle={subtitle}
          icon={icon}
        />
      ) : null}
      <ActionSheet.Content>
        <ActionSheet.ActionGroup accent={accent ?? 'neutral'}>
          {actions.map((action, index) => (
            <ActionSheet.Action key={index} action={action} />
          ))}
        </ActionSheet.ActionGroup>
      </ActionSheet.Content>
    </ActionSheet>
  );
};

export const SimpleActionGroupList = ({
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

function ActionSheetCopyAction({
  action,
  copyText,
  ...props
}: ComponentProps<typeof ActionSheetAction> & { copyText: string }) {
  const { doCopy, didCopy } = useCopy(copyText);
  const resolvedAction: Action = useMemo(
    () => ({
      title: action.title,
      description: action.description,
      action: doCopy,
      startIcon: action.startIcon,
      endIcon: didCopy ? 'Checkmark' : 'Copy',
    }),
    [action, doCopy, didCopy]
  );
  return <ActionSheetAction {...props} action={resolvedAction} />;
}

export const ActionSheet = withStaticProperties(ActionSheetComponent, {
  // Building blocks
  Header: ActionSheetHeader,
  Content: ActionSheetContent,
  ScrollableContent: ActionSheetScrollableContent,
  ContentBlock: ActionSheetContentBlock,
  FormBlock: ActionSheetFormBlock,
  ActionGroup: ActionSheetActionGroup,
  Action: ActionSheetAction,
  ActionFrame: ActionSheetActionFrame,
  ActionGroupContent: ActionSheetActionGroupContent,
  ActionGroupFrame: ActionSheetActionGroupFrame,
  ActionTitle: ActionSheetActionTitle,
  ActionDescription: ActionSheetActionDescription,
  // Prefab components -- used in simple/common applications
  Simple: SimpleActionSheet,
  SimpleHeader: SimpleActionSheetHeader,
  SimpleActionGroupList: SimpleActionGroupList,
  CopyAction: ActionSheetCopyAction,
});
