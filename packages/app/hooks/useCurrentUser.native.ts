import { preSig } from '@tloncorp/api/lib/urbit';

import { useShip } from '../contexts/ship';

export function useCurrentUserId() {
  const { ship, contactId } = useShip();
  const userId = contactId ? preSig(contactId) : ship ? preSig(ship) : null;
  // this should be redundant (contactId should always be present), but throw
  // error to avoid ever having a missing current user when authenticated
  if (!userId) {
    throw new Error('Missing user id');
  }
  return userId;
}
