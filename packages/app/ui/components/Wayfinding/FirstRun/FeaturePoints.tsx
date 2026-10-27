import { Text } from '@tloncorp/ui';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { View, XStack, YStack, useTheme } from 'tamagui';

import type { FeaturePoint, FeaturePointIcon } from './firstRunCopy';

type IconShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | {
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
    };

const ICONS: Record<FeaturePointIcon, IconShape[]> = {
  chat: [
    {
      kind: 'path',
      d: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z',
    },
  ],
  people: [
    { kind: 'circle', cx: 9, cy: 8, r: 3.5 },
    { kind: 'path', d: 'M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6' },
    { kind: 'path', d: 'M16 4.5a3.5 3.5 0 0 1 0 7' },
    { kind: 'path', d: 'M18 14.3c2.1.7 3.5 2.8 3.5 5.7' },
  ],
  plug: [
    { kind: 'path', d: 'M9 2v5M15 2v5' },
    { kind: 'path', d: 'M6 7h12v4a6 6 0 0 1-12 0z' },
    { kind: 'path', d: 'M12 17v5' },
  ],
  computer: [
    { kind: 'rect', x: 3, y: 4, width: 18, height: 12, rx: 2 },
    { kind: 'path', d: 'M8 20h8M12 16v4' },
  ],
  lock: [
    { kind: 'rect', x: 5, y: 11, width: 14, height: 10, rx: 2 },
    { kind: 'path', d: 'M8 11V8a4 4 0 0 1 8 0v3' },
  ],
  sliders: [
    { kind: 'path', d: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1' },
    { kind: 'circle', cx: 15, cy: 6, r: 2 },
    { kind: 'circle', cx: 9, cy: 12, r: 2 },
    { kind: 'circle', cx: 17, cy: 18, r: 2 },
  ],
};

function PointIcon({ name, color }: { name: FeaturePointIcon; color: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name].map((shape, index) =>
        shape.kind === 'path' ? (
          <Path key={index} d={shape.d} />
        ) : shape.kind === 'circle' ? (
          <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ) : (
          <Rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={shape.rx}
          />
        )
      )}
    </Svg>
  );
}

/** The icon rows under a first-run title: an icon tile, a name, a line. */
export function FeaturePointList({ points }: { points: FeaturePoint[] }) {
  const theme = useTheme();
  return (
    <YStack marginHorizontal="$xl" gap="$l">
      {points.map((point) => (
        <XStack key={point.title} gap="$l" alignItems="flex-start">
          <View
            width={40}
            height={40}
            borderRadius={10}
            backgroundColor={
              point.emphasis ? '$positiveBackground' : '$secondaryBackground'
            }
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <PointIcon
              name={point.icon}
              color={
                point.emphasis
                  ? theme.positiveActionText.val
                  : theme.secondaryText.val
              }
            />
          </View>
          <YStack flex={1}>
            <Text
              fontSize={16}
              lineHeight={22}
              fontWeight="500"
              color="$primaryText"
            >
              {point.title}
            </Text>
            <Text fontSize={14} lineHeight={20} color="$secondaryText">
              {point.detail}
            </Text>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}
