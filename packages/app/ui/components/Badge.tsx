import { Pressable } from '@tloncorp/ui';
import { ComponentProps } from 'react';
import { ColorTokens, SizableText, View } from 'tamagui';

export type BadgeType = 'positive' | 'warning' | 'neutral' | 'tertiary';

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
  onPress,
  ...props
}: {
  text: string;
  type?: BadgeType;
  onPress?: (e: React.MouseEvent | React.TouchEvent) => void;
} & ComponentProps<typeof View>) {
  const content = (
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
