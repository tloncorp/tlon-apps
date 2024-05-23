import { ColorTokens, SizableText, Stack } from '../core';

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
}) {
  return (
    <Stack
      backgroundColor={badgeBackground[type]}
      paddingVertical="$xs"
      paddingHorizontal="$l"
      borderRadius="$xl"
    >
      <SizableText size="$s" color={badgeText[type]}>
        {text}
      </SizableText>
    </Stack>
  );
}
