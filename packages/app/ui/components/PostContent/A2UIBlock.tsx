import { createDevLogger } from '@tloncorp/shared';
import { A2UI, type A2UIBlockData } from '@tloncorp/shared/logic';
import { Button, Icon, IconType, Image, Text } from '@tloncorp/ui';
import React, {
  Component,
  ComponentProps,
  ErrorInfo,
  PropsWithChildren,
  useCallback,
  useMemo,
} from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { useContentContext } from './contentUtils';

type RenderOptions = {
  cardDepth?: number;
  parentAlign?: A2UI.Container['align'];
};

const logger = createDevLogger('a2ui-renderer', false);
const EMPTY_COMPONENTS = new Map<string, A2UI.Component>();

const A2UI_ICON_CATALOG: Record<A2UI.IconName, IconType> = {
  accountCircle: 'Profile',
  add: 'Add',
  arrowBack: 'ChevronLeft',
  arrowForward: 'ChevronRight',
  attachFile: 'Attachment',
  calendarToday: 'Clock',
  call: 'ChannelDM',
  camera: 'Camera',
  check: 'Checkmark',
  close: 'Close',
  delete: 'Trash',
  download: 'ArrowDown',
  edit: 'EditList',
  event: 'Clock',
  error: 'Bang',
  fastForward: 'ChevronRight',
  favorite: 'SmushStar',
  favoriteOff: 'SmushStar',
  folder: 'Folder',
  help: 'Info',
  home: 'Home',
  info: 'Info',
  locationOn: 'Pin',
  lock: 'Lock',
  lockOpen: 'Lock',
  mail: 'Mail',
  menu: 'Overflow',
  moreVert: 'Overflow',
  moreHoriz: 'Overflow',
  notificationsOff: 'Muted',
  notifications: 'Notifications',
  pause: 'Stop',
  payment: 'Placeholder',
  person: 'Profile',
  phone: 'ChannelDM',
  photo: 'Camera',
  play: 'Play',
  print: 'Placeholder',
  refresh: 'Refresh',
  rewind: 'ChevronLeft',
  search: 'Search',
  send: 'Send',
  settings: 'Settings',
  share: 'ArrowUp',
  shoppingCart: 'Placeholder',
  skipNext: 'ChevronRight',
  skipPrevious: 'ChevronLeft',
  star: 'SmushStar',
  starHalf: 'SmushStar',
  starOff: 'SmushStar',
  stop: 'Stop',
  upload: 'ArrowUp',
  visibility: 'EyeOpen',
  visibilityOff: 'EyeClosed',
  volumeDown: 'Muted',
  volumeMute: 'Muted',
  volumeOff: 'Muted',
  volumeUp: 'Wave',
  warning: 'Bang',
};

class A2UIErrorBoundary extends Component<
  PropsWithChildren<{ componentCount: number }>,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.trackError('A2UI renderer crashed', {
      errorName: error.name,
      componentCount: this.props.componentCount,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <A2UIFallback />;
    }
    return this.props.children;
  }
}

function A2UIFallback() {
  return (
    <YStack
      borderLeftWidth={2}
      borderColor="$border"
      paddingLeft="$m"
      accessibilityRole="text"
    >
      <Text color="$secondaryText" size="$body">
        Upgrade your app to see this post
      </Text>
    </YStack>
  );
}

function getTextSize(component: A2UI.Text) {
  switch (component.variant) {
    case 'h1':
      return '$title/l';
    case 'h2':
      return '$label/3xl';
    case 'h3':
      return '$label/2xl';
    case 'h4':
      return '$label/xl';
    case 'h5':
      return '$label/l';
    case 'caption':
      return '$label/m';
    default:
      return '$body';
  }
}

function getTextColor(component: A2UI.Text) {
  return component.variant === 'caption' ? '$secondaryText' : '$primaryText';
}

function getImageLayout(component: A2UI.Image) {
  switch (component.variant) {
    case 'icon':
      return { width: 24, height: 24, borderRadius: '$xs' } as const;
    case 'avatar':
      return { width: 40, height: 40, borderRadius: 9999 } as const;
    case 'smallFeature':
      return { width: 100, height: 100, borderRadius: '$m' } as const;
    case 'largeFeature':
      return {
        width: '100%',
        maxWidth: 560,
        aspectRatio: 16 / 9,
        borderRadius: '$m',
      } as const;
    case 'header':
      return {
        width: '100%',
        height: 200,
        borderRadius: '$m',
      } as const;
    case 'mediumFeature':
    default:
      return {
        width: '100%',
        maxWidth: 300,
        aspectRatio: 3 / 2,
        borderRadius: '$m',
      } as const;
  }
}

function getImageFit(component: A2UI.Image) {
  return component.fit === 'scaleDown' ? 'scale-down' : component.fit ?? 'fill';
}

export function getA2UISurfaceLayout(web: boolean) {
  return {
    width: '100%' as const,
    maxWidth: web ? 560 : ('100%' as const),
  };
}

function getComponentGap(
  component: A2UI.Container,
  components: Map<string, A2UI.Component>
) {
  const isTextOnly = component.children.every(
    (child) => components.get(child)?.component === 'Text'
  );

  if (isTextOnly) {
    return component.component === 'Row' ? '$s' : '$xs';
  }

  return '$m';
}

function hasButtonChild(
  component: A2UI.Container,
  components: Map<string, A2UI.Component>
) {
  return component.children.some(
    (child) => components.get(child)?.component === 'Button'
  );
}

function getButtonTreatment(component: A2UI.Button) {
  switch (component.variant) {
    case 'primary':
      return { fill: 'solid', intent: 'positive' } as const;
    case 'secondary':
    case 'borderless':
    default:
      return { fill: 'outline', intent: 'secondary' } as const;
  }
}

function getJustifyContent(justify?: A2UI.Container['justify']) {
  switch (justify) {
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'spaceBetween':
      return 'space-between';
    case 'spaceAround':
      return 'space-around';
    case 'spaceEvenly':
      return 'space-evenly';
    case 'stretch':
      return 'flex-start';
    default:
      return 'flex-start';
  }
}

function getAlignItems(
  align?: A2UI.Container['align'],
  fallback: 'center' | 'stretch' = 'center'
) {
  switch (align) {
    case 'start':
      return 'flex-start';
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'stretch':
      return 'stretch';
    default:
      return fallback;
  }
}

function getComponentFlex(component: A2UI.Component) {
  return component.weight === undefined ? undefined : component.weight;
}

function getTextAlign(align?: A2UI.Container['align']) {
  return align === 'center' ? 'center' : undefined;
}

function getComponentText(
  component: A2UI.Component | undefined,
  components: Map<string, A2UI.Component>
): string {
  if (!component) {
    return '';
  }
  switch (component.component) {
    case 'Text':
      return component.text;
    case 'Button':
    case 'Card':
      return getComponentText(components.get(component.child), components);
    case 'Row':
    case 'Column':
      return component.children
        .map((child) => getComponentText(components.get(child), components))
        .filter(Boolean)
        .join(' ');
    case 'Divider':
      return '';
    case 'Image':
      return component.description ?? '';
    case 'Icon':
      return component.name;
  }
}

type A2UIBlockProps = { block: A2UIBlockData } & ComponentProps<typeof YStack>;

function A2UIBlockContent({ block, ...props }: A2UIBlockProps) {
  const { isA2UIActionAvailable, onA2UIAction } = useContentContext();
  const graph = useMemo(
    () => A2UI.resolveComponentGraph(block.a2ui),
    [block.a2ui]
  );
  const root = graph?.root ?? null;
  const components = graph?.components ?? EMPTY_COMPONENTS;

  const handleButtonPress = useCallback(
    (component: A2UI.Button) => {
      if (
        component.action.event.name === A2UI.action.sendMessage &&
        !component.action.event.context.text.trim()
      ) {
        return;
      }

      onA2UIAction?.(component.action);
    },
    [onA2UIAction]
  );

  const renderComponent = useCallback(
    (id: string, options: RenderOptions = {}): React.ReactNode => {
      const component = components.get(id);
      if (!component) {
        return null;
      }

      switch (component.component) {
        case 'Text': {
          return (
            <Text
              key={component.id}
              size={getTextSize(component)}
              color={getTextColor(component)}
              textAlign={getTextAlign(options.parentAlign)}
              flex={getComponentFlex(component)}
            >
              {component.text}
            </Text>
          );
        }
        case 'Image': {
          return (
            <Image
              key={component.id}
              source={{ uri: component.url }}
              contentFit={getImageFit(component)}
              accessibilityLabel={component.description}
              flex={getComponentFlex(component)}
              backgroundColor="$secondaryBackground"
              {...getImageLayout(component)}
            />
          );
        }
        case 'Icon':
          return (
            <Icon
              key={component.id}
              type={A2UI_ICON_CATALOG[component.name]}
              color="$primaryText"
              size="$m"
              accessibilityLabel={component.name}
              flex={getComponentFlex(component)}
            />
          );
        case 'Row':
          return (
            <XStack
              key={component.id}
              gap={getComponentGap(component, components)}
              marginTop={
                hasButtonChild(component, components) ? '$l' : undefined
              }
              alignItems={getAlignItems(component.align)}
              justifyContent={getJustifyContent(component.justify)}
              flexWrap="wrap"
              width="100%"
              flex={getComponentFlex(component)}
            >
              {component.children.map((child) =>
                renderComponent(child, {
                  cardDepth: options.cardDepth,
                  parentAlign: component.align,
                })
              )}
            </XStack>
          );
        case 'Column': {
          return (
            <YStack
              key={component.id}
              gap={getComponentGap(component, components)}
              alignItems={getAlignItems(component.align, 'stretch')}
              justifyContent={getJustifyContent(component.justify)}
              flex={getComponentFlex(component)}
            >
              {component.children.map((child) =>
                renderComponent(child, {
                  cardDepth: options.cardDepth,
                  parentAlign: component.align,
                })
              )}
            </YStack>
          );
        }
        case 'Card': {
          const isNestedCard = Boolean(options.cardDepth);
          return (
            <YStack
              key={component.id}
              borderWidth={1}
              borderColor="$border"
              borderRadius="$m"
              backgroundColor={
                isNestedCard ? '$background' : '$secondaryBackground'
              }
              padding={isNestedCard ? '$2xl' : '$l'}
              gap={isNestedCard ? '$l' : '$m'}
              flex={getComponentFlex(component)}
              width={isNestedCard ? '100%' : undefined}
              alignSelf={isNestedCard ? 'stretch' : 'flex-start'}
              overflow="hidden"
              accessibilityLabel={getComponentText(component, components)}
            >
              {renderComponent(component.child, {
                cardDepth: (options.cardDepth ?? 0) + 1,
              })}
            </YStack>
          );
        }
        case 'Divider':
          return (
            <View
              key={component.id}
              height={component.axis === 'vertical' ? '100%' : 1}
              minHeight={component.axis === 'vertical' ? 24 : undefined}
              width={component.axis === 'vertical' ? 1 : '100%'}
              backgroundColor="$border"
              marginVertical={component.axis === 'vertical' ? undefined : '$xs'}
              marginHorizontal={
                component.axis === 'vertical' ? '$xs' : undefined
              }
              flex={getComponentFlex(component)}
            />
          );
        case 'Button': {
          const disabled =
            component.disabled ||
            !onA2UIAction ||
            isA2UIActionAvailable?.(component.action) === false;
          const label = getComponentText(
            components.get(component.child),
            components
          );
          const treatment = getButtonTreatment(component);
          return (
            <Button.Frame
              key={component.id}
              size="medium"
              fill={treatment.fill}
              intent={treatment.intent}
              alignSelf={
                options.parentAlign === 'center' ? 'center' : 'flex-start'
              }
              height={44}
              paddingHorizontal="$xl"
              flex={getComponentFlex(component)}
              disabled={disabled}
              dimmed={disabled}
              accessibilityLabel={label}
              onPress={
                disabled ? undefined : () => handleButtonPress(component)
              }
            >
              {components.get(component.child)?.component === 'Icon' ? (
                renderComponent(component.child)
              ) : (
                <Button.Text size="medium">{label}</Button.Text>
              )}
            </Button.Frame>
          );
        }
      }
    },
    [components, handleButtonPress, isA2UIActionAvailable, onA2UIAction]
  );

  if (!root || !graph) {
    return <A2UIFallback />;
  }

  return (
    <YStack
      gap="$s"
      {...getA2UISurfaceLayout(isWeb)}
      accessibilityLabel={getComponentText(components.get(root), components)}
      {...props}
    >
      {renderComponent(root)}
    </YStack>
  );
}

export function A2UIBlock(props: A2UIBlockProps) {
  const update = A2UI.getUpdateMessage(props.block.a2ui);
  const componentCount = update?.updateComponents.components.length ?? 0;
  return (
    <A2UIErrorBoundary componentCount={componentCount}>
      <A2UIBlockContent {...props} />
    </A2UIErrorBoundary>
  );
}
