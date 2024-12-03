import { ComponentProps } from 'react';
import { ColorTokens, SizableText, View } from 'tamagui';

type BadgeType = 'positive' | 'warning' | 'neutral';

const badgeBackground: Record<BadgeType, ColorTokens> = {
  positive: '$positiveBackground',
  warning: '$orangeSoft',
  neutral: '$secondaryBackground',
};

const badgeText: Record<BadgeType, ColorTokens> = {
  positive: '$positiveActionText',
  warning: '$orange',
  neutral: '$secondaryText',
};

export function Badge({
  text,
  type = 'positive',
}: {
  text: string;
  type?: BadgeType;
} & ComponentProps<typeof View>) {
  return (
    <View
      backgroundColor={badgeBackground[type]}
      paddingVertical="$xs"
      paddingHorizontal="$l"
      borderRadius="$xl"
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
}
