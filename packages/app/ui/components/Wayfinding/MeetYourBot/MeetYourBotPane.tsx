import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { View, XStack, YStack, useTheme } from 'tamagui';

import { useIsDarkMode } from '../../../../hooks/useDarkMode';
import { MeetYourBotArt } from './MeetYourBotArt';

type Slide = 1 | 2;
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

const ICONS: Record<string, IconShape[]> = {
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

const SLIDES: Record<
  Slide,
  {
    title: string;
    accent: string;
    points: { icon: keyof typeof ICONS; title: string; detail: string }[];
  }
> = {
  1: {
    title: 'Meet your Tlonbot.',
    accent: 'It works for you, and only you.',
    points: [
      {
        icon: 'chat',
        title: 'Ask it anything',
        detail: 'Questions, web searches and reminders.',
      },
      {
        icon: 'people',
        title: 'Bring it into your chats',
        detail: 'Collaborate with friends in group chats.',
      },
      {
        icon: 'plug',
        title: 'Connect your services',
        detail: 'Hook up the apps and services you already use.',
      },
    ],
  },
  2: {
    title: 'Yours to keep.',
    accent: 'Private by design.',
    points: [
      {
        icon: 'computer',
        title: 'Lives on a computer you own',
        detail:
          'It runs on your own Tlon computer, and you can take it with you any time.',
      },
      {
        icon: 'lock',
        title: 'Zero data retention',
        detail:
          'By default, the AI company behind it keeps none of your messages.',
      },
      {
        icon: 'sliders',
        title: "You're in charge",
        detail: 'You choose who it talks to and what it sees.',
      },
    ],
  },
};

function PointIcon({
  name,
  color,
}: {
  name: keyof typeof ICONS;
  color: string;
}) {
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

/**
 * Two slides introducing the user's Tlonbot, shown while their chat with it is
 * being set up. The second slide's button waits until `ready`.
 */
export function MeetYourBotPane(props: {
  ready: boolean;
  onStartChatting: () => void;
  initialSlide?: Slide;
}) {
  const [slide, setSlide] = useState<Slide>(props.initialSlide ?? 1);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const isDark = useIsDarkMode();
  const content = SLIDES[slide];
  const iconColor = theme.secondaryText.val;

  return (
    <View
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={Math.max(insets.bottom, 16)}
      testID="meet-your-bot"
    >
      <View height={340} width="100%" overflow="hidden">
        <MeetYourBotArt key={slide} slide={slide} width={width} />
      </View>

      <YStack flex={1} gap={20} paddingTop={20} overflow="hidden">
        <Text
          marginHorizontal="$xl"
          fontSize={24}
          lineHeight={30}
          fontWeight="600"
          letterSpacing={-0.3}
          color="$primaryText"
        >
          {content.title}{' '}
          <Text
            fontSize={24}
            lineHeight={30}
            fontWeight="600"
            letterSpacing={-0.3}
            color="$positiveActionText"
          >
            {content.accent}
          </Text>
        </Text>
        <YStack marginHorizontal="$xl" gap={18}>
          {content.points.map((point) => (
            <XStack key={point.title} gap="$l" alignItems="flex-start">
              <View
                width={40}
                height={40}
                borderRadius={10}
                backgroundColor="$secondaryBackground"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                <PointIcon name={point.icon} color={iconColor} />
              </View>
              <YStack flex={1} gap={2}>
                <Text
                  fontSize={17}
                  lineHeight={22}
                  fontWeight="600"
                  letterSpacing={-0.2}
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
      </YStack>

      <YStack paddingHorizontal="$xl" paddingTop="$l" gap={14}>
        <XStack
          justifyContent="center"
          gap="$s"
          accessibilityLabel={`Slide ${slide} of 2`}
        >
          {([1, 2] as const).map((dot) => (
            <View
              key={dot}
              width={7}
              height={7}
              borderRadius={4}
              backgroundColor={
                dot === slide ? '$primaryText' : isDark ? '#4A4646' : '#D6D6D6'
              }
            />
          ))}
        </XStack>
        {slide === 1 ? (
          <Button
            preset="hero"
            shadow
            label="Next"
            onPress={() => setSlide(2)}
            testID="meet-your-bot-next"
          />
        ) : (
          <Button
            preset="hero"
            shadow
            label={props.ready ? 'Start chatting' : 'Getting your chat ready'}
            loading={!props.ready}
            onPress={props.onStartChatting}
            testID="meet-your-bot-start"
          />
        )}
      </YStack>
    </View>
  );
}
