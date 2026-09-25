import type { ShipInfo } from '@tloncorp/shared/db';

export type AuthCookieRefresh = {
  shipName: string;
  shipUrl: string;
  authCookie: string;
};

// Applies a reauth's cookie to a persisted ShipInfo record, or leaves the
// record alone when it belongs to someone else.
//
// Reauth reads module-level client config after its awaits, so a reauth that
// started before a logout or account switch can complete after it (TLON-6500).
// This runs inside StorageItem's write lock as a `setValue` updater, so
// `stored` is the record as of the write -- returning it unchanged is how we
// decline to clobber a logged-out session or another account's record.
//
// Both the ship and the url are checked: a url is not an identity, since the
// same self-hosted endpoint can end up serving a different ship.
export function applyRefreshedAuthCookie(
  stored: ShipInfo | null,
  { shipName, shipUrl, authCookie }: AuthCookieRefresh
): ShipInfo | null {
  if (!stored || stored.ship !== shipName || stored.shipUrl !== shipUrl) {
    return stored;
  }
  return { ...stored, authCookie };
}
