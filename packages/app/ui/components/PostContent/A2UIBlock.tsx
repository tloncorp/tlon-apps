import { A2UI, type A2UIBlockData } from '@tloncorp/shared/logic';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import React, { ComponentProps, useCallback, useMemo } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { useContentContext } from './contentUtils';

type RenderOptions = {
  cardDepth?: number;
  parentAlign?: A2UI.Container['align'];
  /** Chromeless outermost card: the surrounding surface owns the frame. */
  fullBleed?: boolean;
};

function getTextSize(component: A2UI.Text) {
  switch (component.variant) {
    case 'h1':
      return '$title/l';
    case 'h2':
      return '$label/xl';
    case 'h3':
      return '$label/xl';
    case 'caption':
      return '$label/m';
    default:
      return '$body';
  }
}

function getTextColor(component: A2UI.Text) {
  return component.variant === 'caption' ? '$secondaryText' : '$primaryText';
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
  }
}

export function A2UIBlock({
  block,
  fullBleed,
  ...props
}: {
  block: A2UIBlockData;
  /**
   * Render for a surface that owns the frame (the pinned canvas): no width
   * cap, and the outermost Card drops its border, background box, and hug so
   * the tree fills the area edge to edge. Nested cards keep their chrome.
   */
  fullBleed?: boolean;
} & ComponentProps<typeof YStack>) {
  const { isA2UIActionAvailable, onA2UIAction, getA2UIActionState } =
    useContentContext();
  const update = A2UI.getUpdateMessage(block.a2ui);
  const root = A2UI.getRootComponentId(block.a2ui);
  const components = useMemo(() => {
    return new Map(
      update?.updateComponents.components.map((component) => [
        component.id,
        component,
      ]) ?? []
    );
  }, [update]);

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
                  // A Row's `align` is its cross axis — vertical centering,
                  // not text alignment. Only a Column's align should center
                  // text, so it is not forwarded here.
                  fullBleed: options.fullBleed,
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
                  fullBleed: options.fullBleed,
                })
              )}
            </YStack>
          );
        }
        case 'Card': {
          const isNestedCard = Boolean(options.cardDepth);
          if (options.fullBleed && !isNestedCard) {
            return (
              <YStack
                key={component.id}
                backgroundColor="$background"
                padding="$xl"
                gap="$m"
                flex={getComponentFlex(component)}
                width="100%"
                alignSelf="stretch"
              >
                {renderComponent(component.child, {
                  cardDepth: (options.cardDepth ?? 0) + 1,
                  fullBleed: options.fullBleed,
                })}
              </YStack>
            );
          }
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
            >
              {renderComponent(component.child, {
                cardDepth: (options.cardDepth ?? 0) + 1,
                fullBleed: options.fullBleed,
              })}
            </YStack>
          );
        }
        case 'Divider':
          return (
            <View
              key={component.id}
              height={1}
              backgroundColor="$border"
              marginVertical="$xs"
              width="100%"
              flex={getComponentFlex(component)}
            />
          );
        case 'Button': {
          const pending = getA2UIActionState?.(component.action) === 'pending';
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
              onPress={
                disabled ? undefined : () => handleButtonPress(component)
              }
            >
              {pending ? (
                <LoadingSpinner size="small" color="$primaryText" />
              ) : null}
              <Button.Text size="medium">{label}</Button.Text>
            </Button.Frame>
          );
        }
      }
    },
    [
      components,
      handleButtonPress,
      isA2UIActionAvailable,
      onA2UIAction,
      getA2UIActionState,
    ]
  );

  if (!root) {
    return null;
  }

  return (
    <YStack gap="$s" maxWidth={fullBleed ? undefined : 560} {...props}>
      {renderComponent(root, fullBleed ? { fullBleed } : {})}
    </YStack>
  );
}
