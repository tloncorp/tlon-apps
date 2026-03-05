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
  gridDensity?: 'default' | 'compact';
}

export const FacePile = React.memo(function FacePileComponent({
  contactIds,
  maxVisible = 4,
  grid = false,
  totalCount,
  gridDensity = 'default',
}: FacePileProps) {
  const effectiveMaxVisible = grid ? Math.min(maxVisible, 4) : maxVisible;
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

  if (grid) {
    const isCompactGrid = gridDensity === 'compact';

    return (
      <YStack gap={isCompactGrid ? '$2xs' : '$xs'} padding={isCompactGrid ? 1 : 0}>
        <XStack gap={isCompactGrid ? '$2xs' : '$xs'}>
          {visibleContactIds.slice(0, 2).map((contactId) => (
            <ContactAvatar key={contactId} contactId={contactId} size="$xl" />
          ))}
        </XStack>
        <XStack gap={isCompactGrid ? '$2xs' : '$xs'}>
          {visibleContactIds.slice(2, 4).map((contactId) => (
            <ContactAvatar key={contactId} contactId={contactId} size="$xl" />
          ))}
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
            +{formattedCount.text}
          </Text>
        </View>
      )}
    </XStack>
  );
});
