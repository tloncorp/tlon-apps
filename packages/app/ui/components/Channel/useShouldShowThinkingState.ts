import { isBotDmChannel, p } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

import { useCurrentUserId } from '../../contexts';
import { useCanRead } from '../../utils';

export function useShouldShowThinkingState(channel: db.Channel) {
  const currentUserId = useCurrentUserId();
  const canRead = useCanRead(channel, currentUserId);

  const botDmNodeType = useMemo(() => {
    if (channel.type !== 'dm') {
      return null;
    }

    const dmShip = channel.contactId ?? channel.id;

    try {
      return p.kind(dmShip);
    } catch {
      return null;
    }
  }, [channel.contactId, channel.id, channel.type]);

  const isBotDm = useMemo(
    () =>
      isBotDmChannel({ channel }) ||
      // hack: bot detection cues off ~pinser-botter prefix, but that's incomplete in practice. Particularly
      // in dev, where fake galaxies are used. For now, we'll be permissive about which DMs qualify and
      // additionally cue off ship type
      botDmNodeType === 'moon' ||
      botDmNodeType === 'galaxy',
    [botDmNodeType, channel]
  );

  const shouldShowThinkingState = useMemo(
    () => canRead && isBotDm,
    [canRead, isBotDm]
  );

  return shouldShowThinkingState;
}
