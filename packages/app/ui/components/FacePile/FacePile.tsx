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

  if (grid) {
    return (
      <YStack gap={2}>
        <XStack gap={2}>
          {visibleContactIds.slice(0, 2).map((contactId) => (
            <ContactAvatar key={contactId} contactId={contactId} size="$xl" />
          ))}
        </XStack>
        <XStack gap={2}>
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
              <Text fontSize={8} color="$primaryText">
                +{overflowCount}
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
          marginLeft={index === 0 ? 0 : -12}
          zIndex={visibleContactIds.length + index}
        >
          <ContactAvatar contactId={contactId} size="$2xl" />
        </View>
      ))}
      {overflowCount > 0 && (
        <View
          marginLeft={-12}
          zIndex={7}
          width={24}
          height={24}
          borderRadius="$s"
          backgroundColor="$secondaryBackground"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="$xs" color="$primaryText">
            +{overflowCount}
          </Text>
        </View>
      )}
    </XStack>
  );
});
