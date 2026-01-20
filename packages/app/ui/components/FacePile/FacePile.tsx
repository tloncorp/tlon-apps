import { formatCount } from '@tloncorp/shared';
import { Text } from '@tloncorp/ui';
import React, { useMemo } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { ContactAvatar } from '../Avatar';

export interface FacePileProps {
  contactIds: string[];
  maxVisible?: number;
  grid?: boolean;
  /** Total count of contacts (use when contactIds is a sample) */
  totalCount?: number;
}

export const FacePile = React.memo(function FacePileComponent({
  contactIds,
  maxVisible = 4,
  grid = false,
  totalCount,
}: FacePileProps) {
  const effectiveMaxVisible = grid ? Math.min(maxVisible, 3) : maxVisible;
  const visibleContactIds = useMemo(
    () => contactIds.slice(0, effectiveMaxVisible),
    [contactIds, effectiveMaxVisible]
  );
  const total = totalCount ?? contactIds.length;
  const overflowCount = Math.max(0, total - effectiveMaxVisible);
  const formattedCount = useMemo(
    () => formatCount(overflowCount),
    [overflowCount]
  );
  const countSymbol = formattedCount.isRounded ? '⨦' : '+';

  if (grid) {
    return (
      <YStack gap={'$s'}>
        <XStack gap={'$s'}>
          {visibleContactIds.slice(0, 2).map((contactId) => (
            <ContactAvatar key={contactId} contactId={contactId} size="$xl" />
          ))}
        </XStack>
        <XStack gap={'$s'} justifyContent="center">
          {visibleContactIds.slice(2, 3).map((contactId) => (
            <ContactAvatar key={contactId} contactId={contactId} size="$xl" />
          ))}
          {overflowCount > 0 && (
            <View
              width="$xl"
              height="$xl"
              borderRadius="$2xs"
              backgroundColor="$tertiaryBackground"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={8} color="$primaryText" letterSpacing={-0.5}>
                {countSymbol}
                {formattedCount.text}
              </Text>
            </View>
          )}
        </XStack>
      </YStack>
    );
  }

  return (
    <XStack alignItems="center">
      {visibleContactIds.map((contactId, index) => (
        <View
          key={contactId}
          marginLeft={index === 0 ? 0 : '$-l'}
          zIndex={visibleContactIds.length + index}
        >
          <ContactAvatar contactId={contactId} size="$2xl" />
        </View>
      ))}
      {overflowCount > 0 && (
        <View
          marginLeft={'$-l'}
          zIndex={'$l'}
          width={'$2xl'}
          height={'$2xl'}
          borderRadius="$xs"
          backgroundColor="$secondaryBackground"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize={8} color="$primaryText" letterSpacing={-0.5}>
            {countSymbol}
            {formattedCount.text}
          </Text>
        </View>
      )}
    </XStack>
  );
});
