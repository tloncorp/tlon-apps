import { ComponentProps } from 'react';
import { ColorTokens, SizableText, View } from 'tamagui';

type BadgeType = 'positive' | 'warning' | 'neutral' | 'tertiary';

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

export function Badge({
  text,
  type = 'positive',
  ...props
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
}
