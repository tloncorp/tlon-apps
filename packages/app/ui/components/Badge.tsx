import { Pressable } from '@tloncorp/ui';
import { ComponentProps } from 'react';
import { ColorTokens, SizableText, SizeTokens, View } from 'tamagui';

import { getAndroidRoundedBackgroundKey } from '../utils';

export type BadgeType = 'positive' | 'warning' | 'neutral' | 'tertiary';
export type BadgeSize = 'default' | 'micro';

const badgeBackground: Record<BadgeType, ColorTokens | 'unset'> = {
  positive: '$positiveBackground',
  warning: '$orangeSoft',
  neutral: '$secondaryBackground',
  tertiary: 'unset',
};

const badgeText: Record<BadgeType, ColorTokens> = {
  positive: '$positiveActionText',
  warning: '$orange',
  neutral: '$secondaryText',
  tertiary: '$secondaryText',
};

const badgePaddingVertical: Record<BadgeSize, SizeTokens> = {
  default: '$xs',
  micro: '$2xs',
};

const badgePaddingHorizontal: Record<BadgeSize, SizeTokens> = {
  default: '$l',
  micro: '$m',
};

export function Badge({
  text,
  type = 'positive',
  size = 'default',
  onPress,
  backgroundColor = badgeBackground[type],
  ...props
}: {
  text: string;
  type?: BadgeType;
  size?: BadgeSize;
  onPress?: (e: React.MouseEvent | React.TouchEvent) => void;
} & ComponentProps<typeof View>) {
  const content = (
    <View
      key={getAndroidRoundedBackgroundKey(backgroundColor)}
      backgroundColor={backgroundColor}
      paddingVertical={badgePaddingVertical[size]}
      paddingHorizontal={badgePaddingHorizontal[size]}
      borderRadius="$xl"
      {...props}
    >
      <SizableText
        size="$s"
        color={badgeText[type]}
        flexShrink={1}
        width="auto"
      >
        {text}
      </SizableText>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onPress(e);
        }}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}
