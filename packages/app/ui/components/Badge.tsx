import { Pressable } from '@tloncorp/ui';
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
