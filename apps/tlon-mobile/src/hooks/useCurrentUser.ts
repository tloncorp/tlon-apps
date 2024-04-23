import * as urbit from '@tloncorp/shared/dist/urbit';

import { useShip } from '../contexts/ship';

export function useCurrentUserId() {
  const { ship, contactId } = useShip();
  // this should be redundant (contactId should always be present), but
  // using defensive fallback to avoid ever having a missing current
  // user when authenticated
  return contactId ? urbit.preSig(contactId) : ship ? urbit.preSig(ship) : '';
}
