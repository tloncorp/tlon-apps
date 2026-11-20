import { Icon, type IconType, Text } from '@tloncorp/ui';
import type { ComponentProps, ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

import {
  A2UI_CARD_PADDING,
  A2UI_CARD_PADDING_TOP,
  A2UI_CARD_RADIUS,
  A2UI_TEXT_BREAKING,
  A2UI_TYPE,
} from '../../ui/components/PostContent/a2uiCardParts';

/** The bot card surface that browser and wallet cards are drawn on. */
export function BrowserCardFrame({
  icon,
  kicker,
  status,
  media,
  children,
}: {
  icon: IconType;
  kicker: string;
  /** A short state at the far end of the kicker. */
  status?: string;
  /** Edge-to-edge content above the padded body, such as a page preview. */
  media?: ReactNode;
  children: ReactNode;
}) {
  return (
    <YStack
      width="100%"
      maxWidth={560}
      backgroundColor="$background"
      borderWidth={1}
      borderColor="$border"
      borderRadius={A2UI_CARD_RADIUS}
      overflow="hidden"
    >
      {media}
      <YStack
        paddingTop={A2UI_CARD_PADDING_TOP}
        paddingHorizontal={A2UI_CARD_PADDING}
        paddingBottom={A2UI_CARD_PADDING}
      >
        <XStack alignItems="center" gap={6}>
          <Icon type={icon} color="$secondaryText" customSize={[14, 14]} />
          <BrowserCardText type="kicker" flex={1} numberOfLines={1}>
            {kicker}
          </BrowserCardText>
          {status ? (
            <BrowserCardText type="kicker">{status}</BrowserCardText>
          ) : null}
        </XStack>
        {children}
      </YStack>
    </YStack>
  );
}

type CardTextType = keyof typeof A2UI_TYPE;

// The label size A2UIBlock pairs with each card style; the style's own
// metrics override it.
const baseSize: Record<CardTextType, '$label/l' | '$label/m'> = {
  title: '$label/l',
  label: '$label/l',
  labelStrong: '$label/l',
  body: '$label/l',
  note: '$label/m',
  noteStrong: '$label/m',
  kicker: '$label/m',
};

/** Text in the bot card scale, untrimmed so its line heights set the rhythm. */
export function BrowserCardText({
  type,
  color = '$secondaryText',
  ...props
}: { type: CardTextType } & Omit<ComponentProps<typeof Text>, 'size'>) {
  return (
    <Text
      size={baseSize[type]}
      {...A2UI_TYPE[type]}
      color={color}
      trimmed={false}
      {...A2UI_TEXT_BREAKING}
      {...props}
    />
  );
}
