import { preSig } from '@tloncorp/api/lib/urbit';

import { useShip } from '../contexts/ship';
import { currentUserIdFromShipState } from './currentUserIdFromShipState';

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

export function useCurrentUserIdOrNull(): string | null {
  const { ship, contactId } = useShip();
  return currentUserIdFromShipState({ ship, contactId });
}
