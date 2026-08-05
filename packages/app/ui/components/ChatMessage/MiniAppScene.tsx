import { ErrorBoundary, Icon, Image, Pressable, Text } from '@tloncorp/ui';
import type { IconType } from '@tloncorp/ui';
import React, { useCallback } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import type {
  MiniAppJSONValue,
  MiniAppScene as MiniAppSceneData,
  MiniAppSceneNode,
  MiniAppSocialContext,
} from './miniAppRuntime';

type FrameDefaults = {
  height: number;
  width: number;
};

type SceneBounds = {
  height: number;
  width: number;
};

type AbsoluteFrame = {
  height: number | string;
  left: number | string;
  opacity: number;
  overflow: 'visible';
  position: 'absolute';
  style?: React.CSSProperties;
  top: number | string;
  width: number | string;
};

const animationNames = {
  fadeIn: 'tlonMiniAppFadeIn',
  floatUp: 'tlonMiniAppFloatUp',
  pop: 'tlonMiniAppPop',
  pulse: 'tlonMiniAppPulse',
} as const;

const animationCSS = `
@keyframes tlonMiniAppPop {
  0% { opacity: 0.84; transform: scale(0.88); }
  58% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes tlonMiniAppPulse {
  0% { transform: scale(1); }
  45% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
@keyframes tlonMiniAppFloatUp {
  0% { opacity: 0; transform: translateY(12px) scale(0.96); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-22px) scale(1.02); }
}
@keyframes tlonMiniAppFadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
`;

export type MiniAppSceneRendererProps = {
  disabled?: boolean;
  onAction: (action: MiniAppJSONValue) => void;
  scene: MiniAppSceneData;
  socialContext?: MiniAppSocialContext;
};

function num(node: MiniAppSceneNode, key: string, fallback: number): number {
  const value = node[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(node: MiniAppSceneNode, key: string, fallback = ''): string {
  const value = node[key];
  return typeof value === 'string' ? value : fallback;
}

function nodeKey(node: MiniAppSceneNode): string {
  const base =
    node.id ?? `${node.type}-${num(node, 'x', 0)}-${num(node, 'y', 0)}`;
  const transitionKey = str(node, 'transitionKey');
  return transitionKey ? `${base}-${transitionKey}` : base;
}

function int(node: MiniAppSceneNode, key: string, fallback: number): number {
  return Math.floor(num(node, key, fallback));
}

function isInteractionNode(node: MiniAppSceneNode): boolean {
  return (
    node.type === 'button' || node.type === 'hitZone' || node.type === 'hitGrid'
  );
}

function isHitTargetNode(node: MiniAppSceneNode): boolean {
  return node.type === 'hitZone' || node.type === 'hitGrid';
}

function isActionObject(
  action: MiniAppJSONValue | undefined
): action is { [key: string]: MiniAppJSONValue } {
  return (
    typeof action === 'object' && action !== null && !Array.isArray(action)
  );
}

function animationStyle(
  node: MiniAppSceneNode
): React.CSSProperties | undefined {
  const animation = str(node, 'animate') as keyof typeof animationNames;
  const animationName = animationNames[animation];
  if (!animationName) {
    return undefined;
  }

  const duration = Math.min(
    2000,
    Math.max(80, num(node, 'durationMs', animation === 'pulse' ? 620 : 420))
  );
  const delay = Math.min(2000, Math.max(0, num(node, 'delayMs', 0)));
  return {
    animation: `${animationName} ${duration}ms cubic-bezier(0.2, 0.9, 0.2, 1) ${delay}ms both`,
    transformBox: 'fill-box' as React.CSSProperties['transformBox'],
    transformOrigin: 'center',
  };
}

function positiveInt(
  node: MiniAppSceneNode,
  key: string,
  fallback: number
): number {
  const value = num(node, key, fallback);
  return Math.max(1, Math.min(12, Math.floor(value)));
}

function frameProps(
  node: MiniAppSceneNode,
  defaults: FrameDefaults = { height: 40, width: 80 }
): AbsoluteFrame {
  const style = isWeb ? animationStyle(node) : undefined;
  return {
    position: 'absolute' as const,
    left: num(node, 'x', 0),
    top: num(node, 'y', 0),
    width: num(node, 'width', defaults.width),
    height: num(node, 'height', defaults.height),
    overflow: 'visible' as const,
    opacity: num(node, 'opacity', 1),
    ...(style ? { style } : null),
  };
}

function hitGridGapX(node: MiniAppSceneNode): number {
  return Math.max(0, num(node, 'gapX', 0));
}

function hitGridGapY(node: MiniAppSceneNode): number {
  return Math.max(0, num(node, 'gapY', 0));
}

function hitGridColumns(node: MiniAppSceneNode): number {
  return Math.max(1, int(node, 'columns', 1));
}

function hitGridRows(node: MiniAppSceneNode): number {
  return Math.max(1, int(node, 'rows', 1));
}

function hitGridWidth(node: MiniAppSceneNode): number {
  const columns = hitGridColumns(node);
  return (
    columns * num(node, 'cellWidth', 16) +
    Math.max(0, columns - 1) * hitGridGapX(node)
  );
}

function hitGridHeight(node: MiniAppSceneNode): number {
  const rows = hitGridRows(node);
  return (
    rows * num(node, 'cellHeight', 16) +
    Math.max(0, rows - 1) * hitGridGapY(node)
  );
}

function nodeWithHitGridBounds(node: MiniAppSceneNode): MiniAppSceneNode {
  return {
    ...node,
    width: hitGridWidth(node),
    height: hitGridHeight(node),
  };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nativeLocation(event: unknown): {
  locationX: number;
  locationY: number;
  targetHeight?: number;
  targetWidth?: number;
} | null {
  const nativeEvent = (event as { nativeEvent?: unknown })?.nativeEvent;
  const rect = (
    event as {
      currentTarget?: {
        getBoundingClientRect?: () => {
          height: number;
          left: number;
          top: number;
          width: number;
        };
      };
    }
  )?.currentTarget?.getBoundingClientRect?.();
  const nativeEventRecord = nativeEvent as
    | {
        clientX?: unknown;
        clientY?: unknown;
        locationX?: unknown;
        locationY?: unknown;
        offsetX?: unknown;
        offsetY?: unknown;
      }
    | undefined;
  const clientX = finiteNumber(nativeEventRecord?.clientX);
  const clientY = finiteNumber(nativeEventRecord?.clientY);
  const locationX =
    finiteNumber(nativeEventRecord?.locationX) ??
    finiteNumber(nativeEventRecord?.offsetX) ??
    (rect && clientX !== null ? clientX - rect.left : null);
  const locationY =
    finiteNumber(nativeEventRecord?.locationY) ??
    finiteNumber(nativeEventRecord?.offsetY) ??
    (rect && clientY !== null ? clientY - rect.top : null);

  if (locationX === null || locationY === null) {
    return null;
  }

  return {
    locationX,
    locationY,
    ...(rect &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
      ? { targetHeight: rect.height, targetWidth: rect.width }
      : null),
  };
}

function hitGridActionFromLocation(
  node: MiniAppSceneNode,
  locationX: number,
  locationY: number,
  targetWidth?: number,
  targetHeight?: number
): MiniAppJSONValue | null {
  if (!isActionObject(node.action)) {
    return null;
  }

  const gridWidth = hitGridWidth(node);
  const gridHeight = hitGridHeight(node);
  const localX =
    targetWidth && targetWidth > 0
      ? locationX * (gridWidth / targetWidth)
      : locationX;
  const localY =
    targetHeight && targetHeight > 0
      ? locationY * (gridHeight / targetHeight)
      : locationY;
  const columns = hitGridColumns(node);
  const rows = hitGridRows(node);
  const cellWidth = num(node, 'cellWidth', 16);
  const cellHeight = num(node, 'cellHeight', 16);
  const strideX = cellWidth + hitGridGapX(node);
  const strideY = cellHeight + hitGridGapY(node);
  const col = Math.floor(localX / strideX);
  const row = Math.floor(localY / strideY);
  const insideCellX = localX - col * strideX;
  const insideCellY = localY - row * strideY;

  if (
    row < 0 ||
    row >= rows ||
    col < 0 ||
    col >= columns ||
    insideCellX < 0 ||
    insideCellX >= cellWidth ||
    insideCellY < 0 ||
    insideCellY >= cellHeight
  ) {
    return null;
  }

  return {
    ...node.action,
    row,
    col,
    index: row * columns + col,
  };
}

function percent(value: number, total: number): string {
  return `${(value / Math.max(1, total)) * 100}%`;
}

function scalableFrameProps(
  node: MiniAppSceneNode,
  bounds: SceneBounds,
  defaults: FrameDefaults = { height: 40, width: 80 },
  offset = { x: 0, y: 0 }
): AbsoluteFrame {
  const style = isWeb ? animationStyle(node) : undefined;
  return {
    position: 'absolute',
    left: percent(offset.x + num(node, 'x', 0), bounds.width),
    top: percent(offset.y + num(node, 'y', 0), bounds.height),
    width: percent(num(node, 'width', defaults.width), bounds.width),
    height: percent(num(node, 'height', defaults.height), bounds.height),
    overflow: 'visible',
    opacity: num(node, 'opacity', 1),
    ...(style ? { style } : null),
  };
}

function MiniAppAnimationStyles() {
  return isWeb ? <style>{animationCSS}</style> : null;
}

function hasNumber(node: MiniAppSceneNode, key: string): boolean {
  const value = node[key];
  return typeof value === 'number' && Number.isFinite(value);
}

function textFrameProps(node: MiniAppSceneNode, bounds: SceneBounds) {
  const x = num(node, 'x', 0);
  const fontSize = num(node, 'fontSize', 14);
  const lineHeight = Math.ceil(fontSize * 1.2);
  const height = num(
    node,
    'height',
    lineHeight * positiveInt(node, 'lines', 1)
  );
  const y = num(node, 'y', 0);

  return {
    ...frameProps(node, {
      height,
      width: Math.max(24, bounds.width - x - 12),
    }),
    top: hasNumber(node, 'height') ? y : Math.max(0, y - lineHeight),
  };
}

function ActionFrame({
  children,
  frame,
  disabled,
  node,
  onAction,
}: {
  children: React.ReactNode;
  frame?: AbsoluteFrame;
  disabled?: boolean;
  node: MiniAppSceneNode;
  onAction: (action: MiniAppJSONValue) => void;
}) {
  const actionable =
    isInteractionNode(node) &&
    node.action !== undefined &&
    !node.disabled &&
    !disabled;
  const resolvedFrame = frame ?? frameProps(node);
  if (!actionable) {
    return (
      <View
        {...(resolvedFrame as unknown as React.ComponentProps<typeof View>)}
      >
        {children}
      </View>
    );
  }

  return (
    <Pressable
      {...(resolvedFrame as unknown as React.ComponentProps<typeof Pressable>)}
      onPress={() => onAction(node.action!)}
    >
      {children}
    </Pressable>
  );
}

function nodeImageUri(
  node: MiniAppSceneNode,
  socialContext?: MiniAppSocialContext
): string {
  const explicit = str(node, 'src');
  if (explicit) {
    return explicit;
  }

  const ship =
    str(node, 'ship') || str(node, 'contactId') || str(node, 'actor');
  return ship ? socialContext?.profilesByShip[ship]?.avatar ?? '' : '';
}

function nodeShip(node: MiniAppSceneNode): string {
  return str(node, 'ship') || str(node, 'contactId') || str(node, 'actor');
}

function imageFit(node: MiniAppSceneNode): 'cover' | 'contain' {
  return str(node, 'fit') === 'contain' ? 'contain' : 'cover';
}

function renderImageContent(
  node: MiniAppSceneNode,
  socialContext?: MiniAppSocialContext
) {
  const fill = str(node, 'fill', 'transparent');
  const stroke = str(node, 'stroke', 'transparent');
  const strokeWidth = num(node, 'strokeWidth', 0);
  const uri = nodeImageUri(node, socialContext);
  return (
    <View
      width="100%"
      height="100%"
      backgroundColor={fill || '$secondaryBackground'}
      borderColor={stroke || '$border'}
      borderWidth={strokeWidth}
      borderRadius={num(node, 'radius', 8)}
      overflow="hidden"
    >
      {uri ? (
        <Image
          source={{ uri }}
          width="100%"
          height="100%"
          contentFit={imageFit(node)}
          fallback={null}
        />
      ) : (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Text size="$label/s" color="$secondaryText">
            image
          </Text>
        </YStack>
      )}
    </View>
  );
}

function renderAvatarContent(
  node: MiniAppSceneNode,
  socialContext?: MiniAppSocialContext
) {
  const fill = str(node, 'fill', 'transparent');
  const ship = nodeShip(node);
  const uri = nodeImageUri(node, socialContext);
  if (ship) {
    return (
      <ContactAvatar
        contactId={ship}
        overrideUrl={uri || undefined}
        ignoreCalm
        rounded
        size="custom"
        width="100%"
        height="100%"
      />
    );
  }

  return (
    <View
      width="100%"
      height="100%"
      borderRadius={999}
      overflow="hidden"
      backgroundColor={fill || '$secondaryBackground'}
    >
      {uri ? (
        <Image
          source={{ uri }}
          width="100%"
          height="100%"
          contentFit="cover"
          fallback={null}
        />
      ) : (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Text size="$label/s" color="$secondaryText">
            avatar
          </Text>
        </YStack>
      )}
    </View>
  );
}

function renderIconContent(node: MiniAppSceneNode) {
  const fill = str(node, 'fill', 'transparent');
  const stroke = str(node, 'stroke', 'transparent');
  const strokeWidth = num(node, 'strokeWidth', 0);
  const text = str(node, 'text') || str(node, 'label');
  const iconSize = Math.max(
    12,
    Math.min(num(node, 'width', 40), num(node, 'height', 40)) * 0.62
  );
  return (
    <YStack
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
      backgroundColor={fill || 'transparent'}
      borderColor={stroke || 'transparent'}
      borderWidth={strokeWidth}
      borderRadius={num(node, 'radius', 8)}
    >
      <ErrorBoundary
        fallback={
          <Text size="$label/s" color={str(node, 'color', '$secondaryText')}>
            {text || str(node, 'icon', 'icon')}
          </Text>
        }
      >
        <Icon
          type={str(node, 'icon', 'Placeholder') as IconType}
          color={str(node, 'color', '$primaryText') as never}
          customSize={[iconSize, iconSize]}
        />
      </ErrorBoundary>
    </YStack>
  );
}

function svgPaint(value: string, fallback: string): string {
  if (!value || value.startsWith('$')) {
    return fallback;
  }
  return value;
}

function svgTextAnchor(node: MiniAppSceneNode): 'start' | 'middle' | 'end' {
  const align = str(node, 'align');
  if (align === 'center') {
    return 'middle';
  }
  if (align === 'right' || align === 'end') {
    return 'end';
  }
  return 'start';
}

function svgFontWeight(
  node: MiniAppSceneNode
): React.CSSProperties['fontWeight'] {
  const weight = str(node, 'fontWeight');
  return weight ? (weight as React.CSSProperties['fontWeight']) : undefined;
}

function nodeText(node: MiniAppSceneNode): string {
  return str(node, 'text') || str(node, 'label');
}

function renderNode({
  bounds,
  disabled,
  node,
  onAction,
  socialContext,
}: {
  bounds: SceneBounds;
  disabled?: boolean;
  node: MiniAppSceneNode;
  onAction: (action: MiniAppJSONValue) => void;
  socialContext?: MiniAppSocialContext;
}): React.ReactNode {
  if (node.visible === false && !isHitTargetNode(node)) {
    return null;
  }

  const key = nodeKey(node);
  const fill = str(node, 'fill', 'transparent');
  const stroke = str(node, 'stroke', 'transparent');
  const strokeWidth = num(node, 'strokeWidth', 0);
  const text = str(node, 'text') || str(node, 'label');

  switch (node.type) {
    case 'group':
    case 'layer':
      return (
        <ActionFrame
          key={key}
          node={{
            ...node,
            width: num(node, 'width', 0),
            height: num(node, 'height', 0),
          }}
          disabled={disabled}
          onAction={onAction}
        >
          {node.children?.map((child) =>
            renderNode({
              bounds,
              disabled,
              node: child,
              onAction,
              socialContext,
            })
          )}
        </ActionFrame>
      );

    case 'rect':
    case 'roundedRect':
    case 'circle':
    case 'oval':
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          <View
            width="100%"
            height="100%"
            backgroundColor={fill}
            borderColor={stroke}
            borderWidth={strokeWidth}
            borderRadius={
              node.type === 'circle' || node.type === 'oval'
                ? 999
                : num(node, 'radius', node.type === 'roundedRect' ? 8 : 0)
            }
          />
        </ActionFrame>
      );

    case 'line': {
      const x1 = num(node, 'x1', num(node, 'x', 0));
      const y1 = num(node, 'y1', num(node, 'y', 0));
      const x2 = num(node, 'x2', x1 + num(node, 'width', 80));
      const y2 = num(node, 'y2', y1);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const angle = `${Math.atan2(dy, dx)}rad`;
      return (
        <View
          key={key}
          position="absolute"
          left={x1}
          top={y1}
          width={length}
          height={Math.max(1, strokeWidth || 2)}
          backgroundColor={stroke || fill || '$border'}
          transform={[{ rotate: angle }]}
          style={isWeb ? animationStyle(node) : undefined}
        />
      );
    }

    case 'text':
    case 'label': {
      const fontSize = num(node, 'fontSize', 14);
      const lineHeight = Math.ceil(fontSize * 1.2);
      return (
        <ActionFrame
          key={key}
          frame={textFrameProps(node, bounds)}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          <Text
            color={str(node, 'color', '$primaryText')}
            size="$label/m"
            fontSize={fontSize}
            lineHeight={lineHeight}
            numberOfLines={positiveInt(node, 'lines', 1)}
          >
            {text}
          </Text>
        </ActionFrame>
      );
    }

    case 'button':
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          <YStack
            width="100%"
            height="100%"
            alignItems="center"
            justifyContent="center"
            backgroundColor={
              node.disabled || disabled
                ? '$border'
                : fill || '$secondaryBackground'
            }
            borderColor={stroke || '$border'}
            borderWidth={strokeWidth || 1}
            borderRadius={num(node, 'radius', 8)}
            paddingHorizontal="$m"
          >
            <Text
              size="$label/m"
              color={str(node, 'textColor', str(node, 'color', '$primaryText'))}
              fontSize={num(node, 'fontSize', 16)}
              numberOfLines={positiveInt(node, 'lines', 1)}
              textAlign="center"
            >
              {text}
            </Text>
          </YStack>
        </ActionFrame>
      );

    case 'hitZone':
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          <View
            width="100%"
            height="100%"
            backgroundColor={
              node.visible === true
                ? str(node, 'fill', 'rgba(59, 130, 246, 0.16)')
                : 'transparent'
            }
            borderColor={
              node.visible === true
                ? str(node, 'stroke', 'rgba(37, 99, 235, 0.56)')
                : 'transparent'
            }
            borderWidth={
              node.visible === true ? num(node, 'strokeWidth', 1) : 0
            }
            opacity={num(node, 'opacity', node.visible === true ? 0.5 : 1)}
          />
        </ActionFrame>
      );

    case 'hitGrid': {
      const gridNode = nodeWithHitGridBounds(node);
      const frame = frameProps(gridNode);
      const columns = hitGridColumns(node);
      const rows = hitGridRows(node);
      const cellWidth = num(node, 'cellWidth', 16);
      const cellHeight = num(node, 'cellHeight', 16);
      const gapX = hitGridGapX(node);
      const gapY = hitGridGapY(node);
      const cells = Array.from({ length: rows * columns });
      const content =
        node.visible === true ? (
          <View width="100%" height="100%" position="relative">
            {cells.map((_, index) => {
              const col = index % columns;
              const row = Math.floor(index / columns);
              return (
                <View
                  key={`${key}-cell-${index}`}
                  position="absolute"
                  left={col * (cellWidth + gapX)}
                  top={row * (cellHeight + gapY)}
                  width={cellWidth}
                  height={cellHeight}
                  backgroundColor={str(
                    node,
                    'fill',
                    'rgba(59, 130, 246, 0.10)'
                  )}
                  borderColor={str(node, 'stroke', 'rgba(37, 99, 235, 0.46)')}
                  borderWidth={1}
                  opacity={num(node, 'opacity', 0.7)}
                />
              );
            })}
          </View>
        ) : (
          <View width="100%" height="100%" />
        );

      if (node.disabled || disabled || !isActionObject(node.action)) {
        return (
          <View
            key={key}
            {...(frame as unknown as React.ComponentProps<typeof View>)}
            pointerEvents="none"
          >
            {content}
          </View>
        );
      }

      return (
        <Pressable
          key={key}
          {...(frame as unknown as React.ComponentProps<typeof Pressable>)}
          onPress={(event: unknown) => {
            const location = nativeLocation(event);
            if (!location) {
              return;
            }
            const action = hitGridActionFromLocation(
              node,
              location.locationX,
              location.locationY,
              location.targetWidth,
              location.targetHeight
            );
            if (action) {
              onAction(action);
            }
          }}
        >
          {content}
        </Pressable>
      );
    }

    case 'badge':
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          <XStack
            alignItems="center"
            justifyContent="center"
            backgroundColor={fill || '$secondaryBackground'}
            borderRadius={999}
            paddingHorizontal="$m"
            height="100%"
          >
            <Text size="$label/s">{text}</Text>
          </XStack>
        </ActionFrame>
      );

    case 'progress': {
      const max = Math.max(1, num(node, 'max', 1));
      const value = Math.max(0, Math.min(max, num(node, 'value', 0)));
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          <View
            width="100%"
            height="100%"
            borderRadius={999}
            backgroundColor="$secondaryBackground"
            overflow="hidden"
          >
            <View
              width={`${(value / max) * 100}%`}
              height="100%"
              backgroundColor={fill || '$positiveActionText'}
            />
          </View>
        </ActionFrame>
      );
    }

    case 'playingCard':
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          <YStack
            width="100%"
            height="100%"
            borderRadius={8}
            backgroundColor={fill || '$background'}
            borderColor={stroke || '$border'}
            borderWidth={strokeWidth || 1}
            padding="$s"
            justifyContent="space-between"
          >
            <Text size="$label/m">{str(node, 'rank', '?')}</Text>
            <Text size="$title/l" textAlign="center">
              {str(node, 'suit', '')}
            </Text>
          </YStack>
        </ActionFrame>
      );

    case 'image': {
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          {renderImageContent(node, socialContext)}
        </ActionFrame>
      );
    }

    case 'avatar': {
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          {renderAvatarContent(node, socialContext)}
        </ActionFrame>
      );
    }

    case 'icon': {
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          {renderIconContent(node)}
        </ActionFrame>
      );
    }

    case 'path':
    default:
      return (
        <ActionFrame
          key={key}
          node={node}
          disabled={disabled}
          onAction={onAction}
        >
          <YStack
            width="100%"
            height="100%"
            alignItems="center"
            justifyContent="center"
            backgroundColor={fill || '$secondaryBackground'}
            borderColor={stroke || '$border'}
            borderWidth={strokeWidth}
            borderRadius={node.type === 'avatar' ? 999 : num(node, 'radius', 8)}
            overflow="hidden"
          >
            <Text size="$label/s" color={str(node, 'color', '$secondaryText')}>
              {text || str(node, 'icon', node.type)}
            </Text>
          </YStack>
        </ActionFrame>
      );
  }
}

function renderSvgText(node: MiniAppSceneNode) {
  const text = nodeText(node);
  const fontSize = num(node, 'fontSize', 14);
  const lineHeight = Math.ceil(fontSize * 1.2);
  const lines = text.split('\n').slice(0, positiveInt(node, 'lines', 1));
  const x = num(node, 'x', 0);
  const y = num(node, 'y', 0);

  return (
    <text
      key={nodeKey(node)}
      x={x}
      y={y}
      fill={svgPaint(str(node, 'color'), '#1f2933')}
      fontFamily={str(node, 'fontFamily', 'Inter, system-ui, sans-serif')}
      fontSize={fontSize}
      fontWeight={svgFontWeight(node)}
      opacity={num(node, 'opacity', 1)}
      textAnchor={svgTextAnchor(node)}
      style={isWeb ? animationStyle(node) : undefined}
    >
      {lines.map((line, index) => (
        <tspan
          key={`${nodeKey(node)}-line-${index}`}
          x={x}
          dy={index === 0 ? 0 : lineHeight}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

function renderSvgButton(node: MiniAppSceneNode, disabled?: boolean) {
  const x = num(node, 'x', 0);
  const y = num(node, 'y', 0);
  const width = num(node, 'width', 120);
  const height = num(node, 'height', 44);
  const radius = num(node, 'radius', 12);
  const fill =
    node.disabled || disabled
      ? '#d1d5db'
      : svgPaint(str(node, 'fill'), '#2563eb');
  const stroke = svgPaint(str(node, 'stroke'), 'rgba(255,255,255,0.38)');
  const textColor = svgPaint(
    str(node, 'textColor', str(node, 'color')),
    '#ffffff'
  );

  return (
    <g
      key={nodeKey(node)}
      opacity={num(node, 'opacity', 1)}
      style={isWeb ? animationStyle(node) : undefined}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={radius}
        ry={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={num(node, 'strokeWidth', 1)}
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill={textColor}
        fontFamily={str(node, 'fontFamily', 'Inter, system-ui, sans-serif')}
        fontSize={num(node, 'fontSize', 15)}
        fontWeight={svgFontWeight(node) ?? 700}
        dominantBaseline="middle"
        textAnchor="middle"
      >
        {nodeText(node)}
      </text>
    </g>
  );
}

function renderSvgNode({
  bounds,
  disabled,
  node,
}: {
  bounds: SceneBounds;
  disabled?: boolean;
  node: MiniAppSceneNode;
}): React.ReactNode {
  if (node.visible === false && !isHitTargetNode(node)) {
    return null;
  }

  const key = nodeKey(node);
  const x = num(node, 'x', 0);
  const y = num(node, 'y', 0);
  const width = num(node, 'width', node.type === 'badge' ? 96 : 80);
  const height = num(node, 'height', node.type === 'badge' ? 28 : 40);
  const fill = svgPaint(str(node, 'fill'), 'transparent');
  const stroke = svgPaint(str(node, 'stroke'), 'none');
  const strokeWidth = num(node, 'strokeWidth', stroke === 'none' ? 0 : 1);
  const opacity = num(node, 'opacity', 1);
  const style = isWeb ? animationStyle(node) : undefined;

  switch (node.type) {
    case 'group':
    case 'layer':
      return (
        <g
          key={key}
          opacity={opacity}
          transform={`translate(${x} ${y})`}
          style={style}
        >
          {node.children?.map((child) =>
            renderSvgNode({ bounds, disabled, node: child })
          )}
        </g>
      );

    case 'rect':
    case 'roundedRect':
      return (
        <rect
          key={key}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={num(node, 'radius', node.type === 'roundedRect' ? 8 : 0)}
          ry={num(node, 'radius', node.type === 'roundedRect' ? 8 : 0)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          style={style}
        />
      );

    case 'circle': {
      const radius = num(node, 'r', Math.min(width, height) / 2);
      return (
        <circle
          key={key}
          cx={num(node, 'cx', x + width / 2)}
          cy={num(node, 'cy', y + height / 2)}
          r={radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          style={style}
        />
      );
    }

    case 'oval':
      return (
        <ellipse
          key={key}
          cx={num(node, 'cx', x + width / 2)}
          cy={num(node, 'cy', y + height / 2)}
          rx={num(node, 'rx', width / 2)}
          ry={num(node, 'ry', height / 2)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          style={style}
        />
      );

    case 'line':
      return (
        <line
          key={key}
          x1={num(node, 'x1', x)}
          y1={num(node, 'y1', y)}
          x2={num(node, 'x2', x + width)}
          y2={num(node, 'y2', y)}
          stroke={svgPaint(str(node, 'stroke', str(node, 'fill')), '#6b7280')}
          strokeLinecap="round"
          strokeWidth={Math.max(1, num(node, 'strokeWidth', 2))}
          opacity={opacity}
          style={style}
        />
      );

    case 'path': {
      const d = str(node, 'd');
      if (!d) {
        return null;
      }
      return (
        <path
          key={key}
          d={d}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          style={style}
        />
      );
    }

    case 'text':
    case 'label':
      return renderSvgText(node);

    case 'button':
      return renderSvgButton(node, disabled);

    case 'hitZone':
      return node.visible === true ? (
        <rect
          key={key}
          x={x}
          y={y}
          width={width}
          height={height}
          fill={svgPaint(str(node, 'fill'), 'rgba(59, 130, 246, 0.16)')}
          stroke={svgPaint(str(node, 'stroke'), 'rgba(37, 99, 235, 0.56)')}
          strokeWidth={num(node, 'strokeWidth', 1)}
          opacity={num(node, 'opacity', 0.5)}
          style={style}
        />
      ) : null;

    case 'hitGrid': {
      if (node.visible !== true) {
        return null;
      }

      const columns = hitGridColumns(node);
      const rows = hitGridRows(node);
      const cellWidth = num(node, 'cellWidth', 16);
      const cellHeight = num(node, 'cellHeight', 16);
      const gapX = hitGridGapX(node);
      const gapY = hitGridGapY(node);
      return (
        <g key={key} opacity={num(node, 'opacity', 0.7)} style={style}>
          {Array.from({ length: rows * columns }).map((_, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            return (
              <rect
                key={`${key}-cell-${index}`}
                x={x + col * (cellWidth + gapX)}
                y={y + row * (cellHeight + gapY)}
                width={cellWidth}
                height={cellHeight}
                fill={svgPaint(str(node, 'fill'), 'rgba(59, 130, 246, 0.10)')}
                stroke={svgPaint(
                  str(node, 'stroke'),
                  'rgba(37, 99, 235, 0.46)'
                )}
                strokeWidth={num(node, 'strokeWidth', 1)}
              />
            );
          })}
        </g>
      );
    }

    case 'badge':
      return (
        <g key={key} opacity={opacity} style={style}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={height / 2}
            ry={height / 2}
            fill={svgPaint(str(node, 'fill'), '#eef2ff')}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <text
            x={x + width / 2}
            y={y + height / 2}
            fill={svgPaint(
              str(node, 'textColor', str(node, 'color')),
              '#3730a3'
            )}
            fontFamily={str(node, 'fontFamily', 'Inter, system-ui, sans-serif')}
            fontSize={num(node, 'fontSize', 12)}
            fontWeight={svgFontWeight(node) ?? 700}
            dominantBaseline="middle"
            textAnchor="middle"
          >
            {nodeText(node)}
          </text>
        </g>
      );

    case 'progress': {
      const max = Math.max(1, num(node, 'max', 1));
      const value = Math.max(0, Math.min(max, num(node, 'value', 0)));
      const radius = num(node, 'radius', height / 2);
      return (
        <g key={key} opacity={opacity} style={style}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={radius}
            ry={radius}
            fill={svgPaint(str(node, 'trackFill'), '#e5e7eb')}
          />
          <rect
            x={x}
            y={y}
            width={(width * value) / max}
            height={height}
            rx={radius}
            ry={radius}
            fill={svgPaint(str(node, 'fill'), '#22c55e')}
          />
        </g>
      );
    }

    case 'playingCard':
      return (
        <g key={key} opacity={opacity} style={style}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={num(node, 'radius', 10)}
            ry={num(node, 'radius', 10)}
            fill={svgPaint(str(node, 'fill'), '#fffaf0')}
            stroke={svgPaint(str(node, 'stroke'), '#d6c5a2')}
            strokeWidth={num(node, 'strokeWidth', 1)}
          />
          <text
            x={x + 10}
            y={y + 22}
            fill={svgPaint(str(node, 'color'), '#111827')}
            fontFamily={str(node, 'fontFamily', 'Inter, system-ui, sans-serif')}
            fontSize={num(node, 'fontSize', 16)}
            fontWeight={700}
          >
            {str(node, 'rank', '?')}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2}
            fill={svgPaint(str(node, 'color'), '#111827')}
            fontSize={Math.max(24, height * 0.42)}
            dominantBaseline="middle"
            textAnchor="middle"
          >
            {str(node, 'suit', '')}
          </text>
        </g>
      );

    case 'image':
    case 'avatar':
    case 'icon':
      return null;

    default:
      return (
        <rect
          key={key}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={8}
          ry={8}
          fill={fill || '#f3f4f6'}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          style={style}
        />
      );
  }
}

function renderOverlayNode({
  bounds,
  disabled,
  node,
  offset = { x: 0, y: 0 },
  onAction,
  socialContext,
}: {
  bounds: SceneBounds;
  disabled?: boolean;
  node: MiniAppSceneNode;
  offset?: { x: number; y: number };
  onAction: (action: MiniAppJSONValue) => void;
  socialContext?: MiniAppSocialContext;
}): React.ReactNode {
  if (node.visible === false) {
    return null;
  }

  const key = `overlay-${nodeKey(node)}`;
  if (node.type === 'group' || node.type === 'layer') {
    const nextOffset = {
      x: offset.x + num(node, 'x', 0),
      y: offset.y + num(node, 'y', 0),
    };
    return (
      <React.Fragment key={key}>
        {node.children?.map((child) =>
          renderOverlayNode({
            bounds,
            disabled,
            node: child,
            offset: nextOffset,
            onAction,
            socialContext,
          })
        )}
      </React.Fragment>
    );
  }

  if (node.type === 'hitZone') {
    return (
      <ActionFrame
        key={key}
        frame={scalableFrameProps(node, bounds, undefined, offset)}
        node={node}
        disabled={disabled}
        onAction={onAction}
      >
        <View width="100%" height="100%" />
      </ActionFrame>
    );
  }

  if (node.type === 'hitGrid') {
    const gridNode = nodeWithHitGridBounds(node);
    const frame = scalableFrameProps(gridNode, bounds, undefined, offset);
    if (node.disabled || disabled || !isActionObject(node.action)) {
      return (
        <View
          key={key}
          {...(frame as unknown as React.ComponentProps<typeof View>)}
          pointerEvents="none"
        />
      );
    }

    return (
      <Pressable
        key={key}
        {...(frame as unknown as React.ComponentProps<typeof Pressable>)}
        onPress={(event: unknown) => {
          const location = nativeLocation(event);
          if (!location) {
            return;
          }
          const action = hitGridActionFromLocation(
            node,
            location.locationX,
            location.locationY,
            location.targetWidth,
            location.targetHeight
          );
          if (action) {
            onAction(action);
          }
        }}
      >
        <View width="100%" height="100%" />
      </Pressable>
    );
  }

  if (node.type === 'image' || node.type === 'avatar' || node.type === 'icon') {
    const frame = scalableFrameProps(node, bounds, undefined, offset);
    const content =
      node.type === 'image'
        ? renderImageContent(node, socialContext)
        : node.type === 'avatar'
          ? renderAvatarContent(node, socialContext)
          : renderIconContent(node);

    if (node.action === undefined || node.disabled || disabled) {
      return (
        <View
          key={key}
          {...(frame as unknown as React.ComponentProps<typeof View>)}
          pointerEvents="none"
        >
          {content}
        </View>
      );
    }

    return (
      <ActionFrame
        key={key}
        frame={frame}
        node={node}
        disabled={disabled}
        onAction={onAction}
      >
        {content}
      </ActionFrame>
    );
  }

  if (node.action === undefined) {
    return null;
  }

  return (
    <ActionFrame
      key={key}
      frame={scalableFrameProps(node, bounds, undefined, offset)}
      node={node}
      disabled={disabled}
      onAction={onAction}
    >
      <View width="100%" height="100%" />
    </ActionFrame>
  );
}

function SvgMiniAppSceneRenderer({
  disabled,
  onAction,
  scene,
  socialContext,
}: MiniAppSceneRendererProps) {
  const handleAction = useCallback(
    (action: MiniAppJSONValue) => {
      if (!disabled) {
        onAction(action);
      }
    },
    [disabled, onAction]
  );
  const width = scene.width ?? 560;
  const height = scene.height ?? 320;
  const bounds = { height, width };

  return (
    <YStack
      width={width}
      maxWidth="100%"
      height={height}
      borderRadius="$m"
      borderWidth={1}
      borderColor="$border"
      backgroundColor={scene.background || '$background'}
      overflow="hidden"
      position="relative"
    >
      <MiniAppAnimationStyles />
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{
          display: 'block',
          height: '100%',
          inset: 0,
          position: 'absolute',
          width: '100%',
        }}
      >
        {scene.nodes.map((node) =>
          renderSvgNode({
            bounds,
            disabled,
            node,
          })
        )}
      </svg>
      <YStack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        pointerEvents="box-none"
        width="100%"
        height="100%"
      >
        {scene.nodes.map((node) =>
          renderOverlayNode({
            bounds,
            disabled,
            node,
            onAction: handleAction,
            socialContext,
          })
        )}
      </YStack>
    </YStack>
  );
}

function TamaguiMiniAppSceneRenderer({
  disabled,
  onAction,
  scene,
  socialContext,
}: MiniAppSceneRendererProps) {
  const handleAction = useCallback(
    (action: MiniAppJSONValue) => {
      if (!disabled) {
        onAction(action);
      }
    },
    [disabled, onAction]
  );
  const width = scene.width ?? 560;
  const height = scene.height ?? 320;
  const bounds = { height, width };

  return (
    <YStack
      width={width}
      maxWidth="100%"
      height={height}
      borderRadius="$m"
      borderWidth={1}
      borderColor="$border"
      backgroundColor={scene.background || '$background'}
      overflow="hidden"
      position="relative"
    >
      <MiniAppAnimationStyles />
      {scene.nodes.map((node) =>
        renderNode({
          bounds,
          disabled,
          node,
          onAction: handleAction,
          socialContext,
        })
      )}
    </YStack>
  );
}

export function MiniAppSceneRenderer(props: MiniAppSceneRendererProps) {
  return isWeb ? (
    <SvgMiniAppSceneRenderer {...props} />
  ) : (
    <TamaguiMiniAppSceneRenderer {...props} />
  );
}

export function MiniAppScene(props: MiniAppSceneRendererProps) {
  return <MiniAppSceneRenderer {...props} />;
}
