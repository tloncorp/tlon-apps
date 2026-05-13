import * as cn from '@tloncorp/shared/logic';
import { Button, Text } from '@tloncorp/ui';
import React, { ComponentProps, useCallback, useMemo } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { useContentContext } from './contentUtils';

type RenderOptions = {
  cardDepth?: number;
  parentAlign?: cn.A2UIContainerComponent['align'];
};

function getTextSize(component: cn.A2UITextComponent) {
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

function getTextColor(component: cn.A2UITextComponent) {
  return component.variant === 'caption' ? '$secondaryText' : '$primaryText';
}

function getComponentGap(
  component: cn.A2UIContainerComponent,
  components: Map<string, cn.A2UIComponent>
) {
  const hasButton = component.children.some(
    (child) => components.get(child)?.component === 'Button'
  );
  const isTextOnly = component.children.every(
    (child) => components.get(child)?.component === 'Text'
  );

  if (hasButton) {
    return '$m';
  }

  if (isTextOnly) {
    return component.component === 'Row' ? '$s' : '$xs';
  }

  return '$m';
}

function hasButtonChild(
  component: cn.A2UIContainerComponent,
  components: Map<string, cn.A2UIComponent>
) {
  return component.children.some(
    (child) => components.get(child)?.component === 'Button'
  );
}

function getButtonTreatment(component: cn.A2UIButtonComponent) {
  switch (component.variant) {
    case 'primary':
      return { fill: 'solid', intent: 'primary' } as const;
    case 'secondary':
    case 'borderless':
    default:
      return { fill: 'ghost', intent: 'secondary' } as const;
  }
}

function getJustifyContent(justify?: cn.A2UIContainerComponent['justify']) {
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
  align?: cn.A2UIContainerComponent['align'],
  fallback: 'center' | 'stretch' = 'center'
) {
  switch (align) {
    case 'start':
      return 'flex-start';
    case 'end':
      return 'flex-end';
    case 'stretch':
      return 'stretch';
    default:
      return fallback;
  }
}

function getComponentFlex(component: cn.A2UIComponent) {
  return component.weight === undefined ? undefined : component.weight;
}

function getTextAlign(align?: cn.A2UIContainerComponent['align']) {
  return align === 'center' ? 'center' : undefined;
}

function getA2UIComponentText(
  component: cn.A2UIComponent | undefined,
  components: Map<string, cn.A2UIComponent>
): string {
  if (!component) {
    return '';
  }
  switch (component.component) {
    case 'Text':
      return component.text;
    case 'Button':
    case 'Card':
      return getA2UIComponentText(components.get(component.child), components);
    case 'Row':
    case 'Column':
      return component.children
        .map((child) => getA2UIComponentText(components.get(child), components))
        .filter(Boolean)
        .join(' ');
    case 'Divider':
      return '';
  }
}

export function A2UIBlock({
  block,
  ...props
}: { block: cn.A2UIBlockData } & ComponentProps<typeof YStack>) {
  const context = useContentContext();
  const update = cn.getA2UIUpdateMessage(block.a2ui);
  const root = cn.getA2UIRootComponentId(block.a2ui);
  const components = useMemo(() => {
    return new Map(
      update?.updateComponents.components.map((component) => [
        component.id,
        component,
      ]) ?? []
    );
  }, [update]);

  const handleButtonPress = useCallback(
    (component: cn.A2UIButtonComponent) => {
      const text =
        component.action.event.context?.text ??
        getA2UIComponentText(components.get(component.child), components);

      if (!text.trim()) {
        return;
      }

      context.onA2UISendMessage?.(text);
    },
    [components, context]
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
                renderComponent(child, { parentAlign: component.align })
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
                renderComponent(child, { parentAlign: component.align })
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
              shadowColor="$shadow"
              shadowOffset={{ width: 0, height: 8 }}
              shadowOpacity={isNestedCard ? 0.04 : 0.08}
              shadowRadius={isNestedCard ? 12 : 20}
              flex={getComponentFlex(component)}
              width={isNestedCard ? '100%' : undefined}
              alignSelf={isNestedCard ? 'stretch' : 'flex-start'}
              overflow="hidden"
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
              height={1}
              backgroundColor="$border"
              marginVertical="$xs"
              width="100%"
              flex={getComponentFlex(component)}
            />
          );
        case 'Button': {
          const disabled = component.disabled || !context.onA2UISendMessage;
          const label = getA2UIComponentText(
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
              <Button.Text size="medium">{label}</Button.Text>
            </Button.Frame>
          );
        }
      }
    },
    [components, context.onA2UISendMessage, handleButtonPress]
  );

  if (!root) {
    return null;
  }

  return (
    <YStack gap="$s" maxWidth={560} {...props}>
      {renderComponent(root)}
    </YStack>
  );
}
