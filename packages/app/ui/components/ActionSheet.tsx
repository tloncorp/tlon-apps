import { IconButton, useCopy } from '@tloncorp/ui';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { Icon, IconType } from '@tloncorp/ui';
import { Sheet } from '@tloncorp/ui';
import {
  Children,
  ComponentProps,
  Fragment,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { Modal, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Dialog,
  Popover,
  ScrollView,
  SheetProps,
  View,
  VisuallyHidden,
  XStack,
  YStack,
  createStyledContext,
  getTokenValue,
  styled,
  withStaticProperties,
} from 'tamagui';

import { ListItem } from './ListItem';

type Accent = 'positive' | 'negative' | 'neutral' | 'disabled';

export type Action = {
  title: string;
  description?: string;
  action?: () => void;
  disabled?: boolean;
  selected?: boolean;
  render?: (props: ActionRenderProps) => ReactElement;
  endIcon?: IconType | ReactElement;
  startIcon?: IconType | ReactElement;
  accent?: Accent;
  testID?: string;
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

export function createCopyAction({
  title,
  description,
  copyText,
}: {
  title: string;
  description?: string;
  copyText: string;
}): Action {
  return {
    title,
    description: description ?? copyText,
    render: (props) => (
      <ActionSheet.CopyAction {...props} copyText={copyText} />
    ),
  };
}

type AdaptiveMode = 'sheet' | 'dialog' | 'popover';

type ActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  trigger?: ReactNode;
  mode?: AdaptiveMode;
  dialogContentProps?: ComponentProps<typeof Dialog.Content>;
  closeButton?: boolean;
};

const useAdaptiveMode = (mode?: AdaptiveMode) => {
  const isWindowNarrow = useIsWindowNarrow();

  // On mobile, always use sheet regardless of specified mode
  if (isWindowNarrow) {
    return 'sheet';
  }

  // On desktop, use specified mode or default to dialog
  return mode ?? 'dialog';
};

// Main component

const ActionSheetComponent = ({
  open,
  onOpenChange,
  title,
  trigger,
  mode: forcedMode,
  children,
  dialogContentProps,
  closeButton,
  ...props
}: PropsWithChildren<ActionSheetProps & SheetProps>) => {
  const mode = useAdaptiveMode(forcedMode);
  const hasOpened = useRef(open);
  const { bottom } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxHeight = height - bottom - getTokenValue('$2xl');

  if (!hasOpened.current && open) {
    hasOpened.current = true;
  }

  // Sheets/dialogs are heavy; we don't want to render until we need to
  if (!hasOpened.current && trigger === undefined) {
    return null;
  }

  if (mode === 'popover') {
    return (
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        allowFlip
        placement="bottom-end"
      >
        <Popover.Trigger>{trigger}</Popover.Trigger>
        <Popover.Content padding={1} borderColor="$border" borderWidth={1}>
          {children}
        </Popover.Content>
      </Popover>
    );
  }

  if (mode === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <VisuallyHidden>
            <Dialog.Title>{title}</Dialog.Title>
          </VisuallyHidden>
          <Dialog.Overlay
            backgroundColor="$darkOverlay"
            key="overlay"
            opacity={0.5}
          />
          <Dialog.Content
            borderWidth={1}
            borderColor="$border"
            padding={0}
            width="50%"
            maxWidth={800}
            minWidth={400}
            key="content"
            // prevent the modal from going off screen
            maxHeight={maxHeight}
            marginVertical="$2xl"
            {...dialogContentProps}
          >
            {closeButton && (
              <XStack
                width="100%"
                justifyContent="flex-end"
                paddingTop="$l"
                paddingRight="$l"
              >
                <Dialog.Close>
                  <IconButton
                    backgroundColor="$border"
                    height={24}
                    width={24}
                    borderRadius="$m"
                  >
                    <Icon
                      type="Close"
                      customSize={[14, 14]}
                      color="$secondaryText"
                    />
                  </IconButton>
                </Dialog.Close>
              </XStack>
            )}
            {children}
          </Dialog.Content>
        </Dialog.Portal>

        {/* Should not be necessary, but just in case */}
        <Dialog.Adapt when="sm">
          <Dialog.Sheet>
            <Dialog.Sheet.Overlay />
            <Dialog.Sheet.Frame>
              <Dialog.Sheet.ScrollView>
                <Dialog.Adapt.Contents />
              </Dialog.Sheet.ScrollView>
            </Dialog.Sheet.Frame>
          </Dialog.Sheet>
        </Dialog.Adapt>
      </Dialog>
    );
  }

  return (
    <>
      {trigger}
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
            {forcedMode === 'popover' ? (
              <ActionSheet.ScrollableContent>
                <ActionSheet.ContentBlock>{children}</ActionSheet.ContentBlock>
              </ActionSheet.ScrollableContent>
            ) : (
              children
            )}
          </Sheet.Frame>
        </Sheet>
      </Modal>
    </>
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
        <ListItem paddingHorizontal="$2xl">{children}</ListItem>
      </ActionSheetHeaderFrame>
    );
  }
);

// Content wrappers

const ActionSheetContent = YStack.styleable((props, ref) => {
  const contentStyle = useContentStyle();
  return <YStack {...contentStyle} {...props} ref={ref} />;
});

// On Android + tamagui@1.26.12, `Sheet.ScrollView` breaks press handlers after
// any amount of scrolling, so we use a base scrollview instead. In theory, this
// means that the transition between scrolling to the top of the scrollview and
// swiping the sheet down may not be handled as well.
const SheetScrollView =
  Platform.OS === 'android' ? ScrollView : Sheet.ScrollView;

const ActionSheetScrollableContent = ({
  ...props
}: ComponentProps<typeof Sheet.ScrollView>) => {
  const contentStyle = useContentStyle();
  return (
    <SheetScrollView
      flex={1}
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
  const isWindowNarrow = useIsWindowNarrow();
  return {
    paddingBottom: isWindowNarrow
      ? insets.bottom + getTokenValue('$2xl', 'size')
      : 0,
  };
};

// Content blocks

/**
 * Generic content block
 */
const ActionSheetContentBlock = styled(View, {
  name: 'ActionSheetContentBlock',
  padding: '$xl',
  $gtSm: {
    padding: '$l',
  },
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
  borderless: boolean;
  accent: Accent;
}>({
  borderless: false,
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
        borderColor: '$border',
      },
    },
  } as const,
});

/**
 * Render children, adding separator lines between them.
 */
const ActionSheetActionGroup = ActionSheetActionGroupFrame.styleable<{
  contentProps?: ComponentProps<typeof ActionSheetActionGroupContent>;
}>(({ contentProps, ...props }, ref) => {
  const actions = Children.toArray(props.children);
  return (
    <ActionSheetActionGroupFrame {...props} ref={ref}>
      <ActionSheetActionGroupContent {...contentProps}>
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
});

const ActionSheetActionGroupSeparator = styled(View, {
  name: 'ActionSheetActionGroupSeparator',
  height: 1,
  backgroundColor: '$secondaryBorder',
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
    borderless: {
      true: {},
      false: {},
    },
  } as const,
});

// Single action row

const ActionSheetActionFrame = styled(ListItem, {
  name: 'ActionSheetActionFrame',
  context: ActionSheetActionGroupContext,
  borderRadius: 0,
  paddingHorizontal: '$2xl',
  paddingVertical: '$l',
  alignItems: 'center',
  $gtSm: {
    paddingHorizontal: '$l',
    paddingVertical: '$m',
  },
  pressStyle: {
    backgroundColor: '$secondaryBackground',
  },
  cursor: 'pointer',
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
      selected: {
        backgroundColor: '$positiveBackground',
        pressStyle: {
          backgroundColor: '$positiveBackground',
        },
      },
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
  maxWidth: '100%',
  $gtSm: {
    maxWidth: '100%',
  },
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

const ActionSheetMainContent = styled(YStack, {
  name: 'ActionSheetMainContent',
  flex: 1,
  justifyContent: 'space-evenly',
  height: '$4xl',
});

function ActionSheetAction({
  action,
  testID,
}: {
  action: Action;
  testID?: string;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const accent: Accent = useContext(ActionSheetActionGroupContext).accent;
  return action.render ? (
    action.render({ action })
  ) : (
    <ActionSheetActionFrame
      type={
        action.selected
          ? 'selected'
          : action.disabled
            ? 'disabled'
            : action.accent ?? accent
      }
      onPress={accent !== 'disabled' ? action.action : undefined}
      height={isWindowNarrow ? undefined : '$4xl'}
      testID={testID}
    >
      {action.startIcon &&
        resolveIcon(action.startIcon, action.accent ?? accent)}
      <ActionSheetMainContent>
        <ActionSheet.ActionTitle accent={action.accent ?? accent}>
          {action.title}
        </ActionSheet.ActionTitle>
        {action.description && (
          <ActionSheet.ActionDescription>
            {action.description}
          </ActionSheet.ActionDescription>
        )}
      </ActionSheetMainContent>
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
  size: '$m',
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
    borderless: {
      true: {},
      false: {},
    },
  } as const,
});

// Higher-level prefabs

export const SimpleActionSheetHeader = ({
  title,
  subtitle,
  icon,
}: {
  title?: string | null;
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
            <ActionSheet.Action
              key={index}
              action={action}
              testID={action.testID}
            />
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
          <ActionSheet.Action
            key={index}
            action={action}
            testID={`ActionSheetAction-${action.title}`}
          />
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
  MainContent: ActionSheetMainContent,
  ActionFrame: ActionSheetActionFrame,
  ActionIcon: ActionSheetActionIcon,
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
