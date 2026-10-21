import * as store from '@tloncorp/shared/store';
import { useMemo } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { botDeliveryFrom } from '../../ui/components/automationTaskDraft';

/**
 * What decides where the owner's bot may post: a seat in the group and,
 * where a channel asks roles of its readers or its writers, one of each. All
 * of it comes from this device's copy of the groups. Until that has loaded
 * `known` is false and the bot is taken to be in no group, so no channel is
 * offered on a partial answer.
 */
export function useBotDelivery(
  botShip: string,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const currentUserId = useCurrentUserId();
  const botContactIds = useMemo(() => [botShip], [botShip]);
  const { data: seats } = store.useJoinedGroupSeats(botContactIds, { enabled });
  const { data: roles } = store.useMemberGroupRoles(botShip, { enabled });
  const { data: writers } = store.useChannelWriterRoles({ enabled });
  const { data: readers } = store.useChannelReaderRoles({ enabled });
  const delivery = useMemo(
    () =>
      botDeliveryFrom({
        botShip,
        ownerShip: currentUserId,
        seats,
        roles,
        writers,
        readers,
      }),
    [botShip, currentUserId, seats, roles, writers, readers]
  );
  return { delivery, known: Boolean(seats && roles && writers && readers) };
}
