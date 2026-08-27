import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Icon, Pressable } from '@tloncorp/ui';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { getOwnContextLensStamp } from './lensPost';
import { useContextLensAvailable } from './useContextLensStore';

export function ContextLensButton({
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

  if (!available || !stamp || !onPress) {
    return null;
  }

  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress(post);
      }}
      accessibilityLabel="View bot run"
      accessibilityRole="button"
      width={Platform.OS === 'web' ? 20 : 24}
      height={Platform.OS === 'web' ? 20 : 24}
      hitSlop={6}
      alignItems="center"
      justifyContent="center"
      borderRadius="$m"
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      testID="ContextLensPostButton"
    >
      <Icon
        type="InfoCircle"
        customSize={Platform.OS === 'web' ? [16, 16] : [20, 20]}
        color="$tertiaryText"
      />
    </Pressable>
  );
}
