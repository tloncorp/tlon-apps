import {
  isToday,
  makePrettyDayAndDateAndTime,
  makePrettyTime,
} from '@tloncorp/shared/logic';
import { Text } from '@tloncorp/ui';
import { ComponentProps, useMemo } from 'react';
import { ColorTokens, View } from 'tamagui';

type SentTimeTextProps = {
  sentAt?: number | null;
  showFullDate?: boolean;
  color?: ColorTokens;
} & ComponentProps<typeof View>;

export function SentTimeText({
  sentAt,
  showFullDate = false,
  color = '$secondaryText',
  ...viewProps
}: SentTimeTextProps) {
  const timeDisplay = useMemo(() => {
    if (!sentAt) {
      return null;
    }
    const date = new Date(sentAt);
    if (showFullDate && !isToday(date.getTime())) {
      const { asString } = makePrettyDayAndDateAndTime(date);
      return asString;
    }
    return makePrettyTime(date);
  }, [sentAt, showFullDate]);

  if (!timeDisplay) {
    return null;
  }

  return (
    <View {...viewProps}>
      <Text size="$label/m" color={color}>
        {timeDisplay}
      </Text>
    </View>
  );
}
