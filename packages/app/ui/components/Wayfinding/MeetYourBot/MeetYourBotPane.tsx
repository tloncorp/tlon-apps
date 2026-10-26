import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack, useTheme } from 'tamagui';

import { useIsDarkMode } from '../../../../hooks/useDarkMode';
import { PointIcon } from '../FirstRun/FeaturePoints';
import type { FeaturePointIcon } from '../FirstRun/firstRunCopy';
import { MeetYourBotArt } from './MeetYourBotArt';

type Slide = 1 | 2;
const SLIDES: Record<
  Slide,
  {
    title: string;
    accent: string;
    points: { icon: FeaturePointIcon; title: string; detail: string }[];
  }
> = {
  1: {
    title: 'Meet your Tlonbot.',
    accent: 'It works for you, and only you.',
    points: [
      {
        icon: 'people',
        title: 'Bring it into your chats',
        detail: 'Collaborate with friends in your workspaces.',
      },
      {
        icon: 'chat',
        title: 'Ask it anything',
        detail: 'Questions, web searches and reminders.',
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
        title: 'Lives on a private computer you own',
        detail: 'You can take it with you any time.',
      },
      {
        icon: 'lock',
        title: 'Zero data retention',
        detail: 'By default, the AI behind it keeps none of your messages.',
      },
      {
        icon: 'sliders',
        title: "You're in charge",
        detail: 'You choose who it talks to and what it sees.',
      },
    ],
  },
};

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

      {/* On short phones (an iPhone SE leaves about 186 points here) the
          text scrolls rather than being cut off. Keyed by slide so slide 2
          starts at the top even if slide 1 was scrolled. */}
      <ScrollView
        key={slide}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 20, paddingTop: 20, paddingBottom: 8 }}
        bounces={false}
      >
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
      </ScrollView>

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
