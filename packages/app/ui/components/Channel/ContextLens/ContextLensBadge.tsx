import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Pressable } from '@tloncorp/ui';
import { useMemo } from 'react';
import { SizableText, XStack } from 'tamagui';

import { activateAgentControlFromKeyboard } from '../../AgentTaskRows/keyboardControl';
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

  const badge = (
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
  );

  return (
    <XStack paddingLeft="$4xl" paddingBottom="$l">
      {onPress ? (
        <Pressable
          onPress={() => onPress(post)}
          onKeyDown={(event) =>
            activateAgentControlFromKeyboard(event, () => onPress(post))
          }
          role="button"
          tabIndex={0}
          aria-label="Open bot run activity"
          minHeight={44}
          alignItems="center"
          justifyContent="center"
          borderRadius="$s"
          hoverStyle={{ opacity: 0.82 }}
          pressStyle={{ opacity: 0.68 }}
          focusVisibleStyle={{
            outlineColor: '$primaryText',
            outlineOffset: 2,
            outlineStyle: 'solid',
            outlineWidth: 2,
          }}
        >
          {badge}
        </Pressable>
      ) : (
        badge
      )}
    </XStack>
  );
}
