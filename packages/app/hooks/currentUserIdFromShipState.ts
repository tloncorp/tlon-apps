import { preSig } from '@tloncorp/api/lib/urbit';

export function currentUserIdFromShipState(input: {
  ship: string | null | undefined;
  contactId: string | null | undefined;
}): string | null {
  const { ship, contactId } = input;
  return contactId ? preSig(contactId) : ship ? preSig(ship) : null;
}
