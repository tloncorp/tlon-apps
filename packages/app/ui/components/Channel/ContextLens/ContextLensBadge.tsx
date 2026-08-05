import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Pressable } from '@tloncorp/ui';
import { useMemo } from 'react';
import { SizableText, XStack } from 'tamagui';

import { getOwnContextLensStamp } from './lensPost';
import { useContextLensAvailable } from './useContextLensStore';

export function ContextLensBadge({
  post,
  onPress,
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
}) {
  const available = useContextLensAvailable();
  const { data: ownedBotShips } = store.useContextLensBotShips();
  const stamp = useMemo(
    () => getOwnContextLensStamp(post, ownedBotShips ?? []),
    [ownedBotShips, post]
  );

  if (!available || !stamp) {
    return null;
  }

  return (
    <XStack paddingLeft="$4xl" paddingBottom="$l">
      <Pressable
        onPress={onPress ? () => onPress(post) : undefined}
        borderRadius="$s"
      >
        <XStack
          alignItems="center"
          gap="$xs"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$s"
          paddingHorizontal="$s"
          paddingVertical="$2xs"
          backgroundColor="$secondaryBackground"
        >
          <SizableText size="$xs" color="$secondaryText">
            ⟐ Bot run
          </SizableText>
        </XStack>
      </Pressable>
    </XStack>
  );
}
