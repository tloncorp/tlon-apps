import { Text } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { View, XStack, YStack, useTheme } from 'tamagui';

import { firstRunCopy } from './firstRunCopy';

export const MAKE_SPACE_ART_HEIGHT = 360;

// The phones are drawn as a 390-wide screen shown at half size, like the
// app's Channels tour, then tilted. Positions are from the design canvas.
const SCREEN_WIDTH = 390;
const SCALE = 0.5;
const PHONE = { width: 196, height: 420, radius: 30 };
const FADE_FROM = 270;

const art = firstRunCopy.space.art;

const TILES: {
  background: string;
  stroke: string;
  drawing: (stroke: string) => ReactNode;
}[] = [
  {
    background: '#EEF4FD',
    stroke: '#2B5DB8',
    drawing: (stroke) => (
      <Svg width={90} height={76} viewBox="0 0 52 44" fill="none">
        <Circle
          cx={20}
          cy={22}
          r={15}
          stroke={stroke}
          strokeWidth={3}
          strokeDasharray="2.6 2.4"
        />
        <Circle cx={20} cy={22} r={3.2} stroke={stroke} strokeWidth={1.3} />
        <Circle
          cx={41}
          cy={22}
          r={8}
          stroke={stroke}
          strokeWidth={2.4}
          strokeDasharray="2.2 2.2"
        />
      </Svg>
    ),
  },
  {
    background: '#EEF6EC',
    stroke: '#3E7D35',
    drawing: (stroke) => (
      <Svg width={80} height={80} viewBox="0 0 48 48" fill="none">
        <Circle
          cx={24}
          cy={26}
          r={16}
          stroke={stroke}
          strokeWidth={5}
          strokeDasharray="3 1.8"
        />
        <Circle cx={24} cy={26} r={2} fill={stroke} />
        <Path
          d="M14 4L20 26M34 4L28 26"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    ),
  },
  {
    background: '#F6F0EA',
    stroke: '#8A5A2B',
    drawing: (stroke) => (
      <Svg width={96} height={68} viewBox="0 0 56 40" fill="none">
        <Path
          d="M4 30L52 12"
          stroke={stroke}
          strokeWidth={7}
          strokeLinecap="round"
        />
        <Circle cx={18} cy={24.8} r={1.8} fill="#F6F0EA" />
        <Circle cx={28} cy={21} r={1.8} fill="#F6F0EA" />
        <Circle cx={38} cy={17.3} r={1.8} fill="#F6F0EA" />
      </Svg>
    ),
  },
];

function Phone({
  left,
  top,
  rotate,
  children,
}: {
  left: number;
  top: number;
  rotate: string;
  children: ReactNode;
}) {
  return (
    <View
      position="absolute"
      left={left}
      top={top}
      width={PHONE.width}
      height={PHONE.height}
      borderRadius={PHONE.radius}
      borderWidth={1}
      borderColor="$border"
      backgroundColor="$background"
      overflow="hidden"
      rotate={rotate}
      shadowColor="#1E285A"
      shadowOffset={{ width: 0, height: 18 }}
      shadowOpacity={0.12}
      shadowRadius={20}
    >
      <View
        width={SCREEN_WIDTH}
        style={{ transform: [{ scale: SCALE }], transformOrigin: 'top left' }}
      >
        <View height={48} />
        {children}
      </View>
    </View>
  );
}

function ChannelHeader({
  title,
  trailing,
}: {
  title: string;
  trailing: ReactNode;
}) {
  const theme = useTheme();
  return (
    <XStack
      height={56}
      paddingHorizontal="$l"
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth={1}
      borderColor="$border"
    >
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 5l-7 7 7 7"
          stroke={theme.primaryText.val}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <XStack alignItems="center" gap="$m">
        <View
          width={26}
          height={26}
          borderRadius={5}
          backgroundColor="$positiveBackground"
        />
        <Text fontSize={18} fontWeight="500" color="$primaryText">
          {title}
        </Text>
      </XStack>
      {trailing}
    </XStack>
  );
}

function Author({ from }: { from: 'bot' | 'friend' }) {
  return (
    <XStack alignItems="center" gap={10}>
      <View
        width={26}
        height={26}
        borderRadius={5}
        backgroundColor={from === 'bot' ? '$primaryText' : '#6B4FD8'}
      />
      <Text fontSize={18} fontWeight="500" color="$primaryText">
        {from === 'bot' ? art.bot : art.friend}
      </Text>
      {from === 'bot' ? (
        <View
          paddingHorizontal="$s"
          borderRadius={4}
          backgroundColor="$secondaryBackground"
        >
          <Text fontSize={12} lineHeight={18} color="$secondaryText">
            {art.botBadge}
          </Text>
        </View>
      ) : null}
    </XStack>
  );
}

/**
 * Screen 5's picture: an example private space, Bike Parts, on two tilted
 * phones — its Build chat with a starting brief, and its Parts gallery.
 */
export function MakeSpaceArt() {
  const theme = useTheme();
  const background = theme.background.val;
  return (
    <View
      height={MAKE_SPACE_ART_HEIGHT}
      width="100%"
      overflow="hidden"
      accessible
      accessibilityRole="image"
      accessibilityLabel={firstRunCopy.space.artLabel}
    >
      <View
        width={SCREEN_WIDTH}
        height="100%"
        alignSelf="center"
        // The picture's label describes it; its text is only illustration.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Phone left={30} top={40} rotate="-5deg">
          <ChannelHeader
            title={art.chatTitle}
            trailing={
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Circle
                  cx={11}
                  cy={11}
                  r={6.5}
                  stroke={theme.primaryText.val}
                  strokeWidth={1.8}
                />
                <Path
                  d="M16 16l4 4"
                  stroke={theme.primaryText.val}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              </Svg>
            }
          />
          <YStack paddingVertical={20} paddingHorizontal="$xl" gap={22}>
            {art.messages.map((message, index) => (
              <YStack key={index} gap="$xs">
                <Author from={message.from} />
                {message.lines.map((line, lineIndex) => (
                  <Text
                    key={lineIndex}
                    marginLeft={36}
                    marginTop={lineIndex > 0 ? '$s' : 0}
                    fontSize={17}
                    lineHeight={25}
                    color="$primaryText"
                  >
                    {line}
                  </Text>
                ))}
              </YStack>
            ))}
          </YStack>
        </Phone>

        <Phone left={170} top={64} rotate="5deg">
          <ChannelHeader
            title={art.galleryTitle}
            trailing={
              <Text fontSize={18} fontWeight="500" color="$primaryText">
                {art.galleryAction}
              </Text>
            }
          />
          <XStack
            paddingVertical={14}
            paddingHorizontal={10}
            flexWrap="wrap"
            gap={12}
          >
            {art.tiles.map((caption, index) => {
              const tile = TILES[index % TILES.length];
              return (
                <YStack
                  key={caption}
                  width={(SCREEN_WIDTH - 20 - 12) / 2}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius={12}
                  overflow="hidden"
                >
                  <XStack
                    height={36}
                    paddingHorizontal="$l"
                    alignItems="center"
                    justifyContent="space-between"
                    borderBottomWidth={1}
                    borderColor="$border"
                  >
                    <Text fontSize={15} color="$secondaryText">
                      {art.bot}
                    </Text>
                    <Text fontSize={15} color="$secondaryText">
                      {art.today}
                    </Text>
                  </XStack>
                  <View
                    height={150}
                    backgroundColor={tile.background}
                    alignItems="center"
                    justifyContent="center"
                  >
                    {tile.drawing(tile.stroke)}
                  </View>
                  <Text
                    paddingVertical={10}
                    paddingHorizontal="$l"
                    fontSize={15}
                    lineHeight={20}
                    color="$primaryText"
                  >
                    {caption}
                  </Text>
                </YStack>
              );
            })}
          </XStack>
        </Phone>
      </View>

      {/* The phones fade into the page above the title. */}
      <View
        position="absolute"
        left={0}
        right={0}
        top={FADE_FROM}
        bottom={0}
        pointerEvents="none"
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="makeSpaceFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={background} stopOpacity={0} />
              <Stop offset="1" stopColor={background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#makeSpaceFade)" />
        </Svg>
      </View>
    </View>
  );
}
