import * as db from '@tloncorp/shared/db';
import { useEffect, useState } from 'react';

export type HostingSessionState =
  /** The stored credentials have not been read yet. */
  | 'checking'
  /** Usable: the bot queries can run. */
  | 'valid'
  /** Present but stale — the user has to log in again. */
  | 'expired'
  /** No credentials at all; nothing here can load. */
  | 'missing';

/**
 * Whether the stored hosting session can back the bot settings queries.
 *
 * Those queries retry on an interval until they succeed, so a surface that
 * mounts them without a usable session polls the hosting API forever instead of
 * telling the user to log in. Gate on 'valid' before mounting them.
 */
export function useHostingSession(): HostingSessionState {
  const [readState, setReadState] = useState<HostingSessionState>('checking');
  // A session can go stale while a screen stays mounted: returning from the
  // background runs refreshHostingAuth, which sets this flag. The stored value
  // is read reactively so an already-open Settings tab drops the bot queries
  // rather than leaving them retrying against a dead session.
  const expired = db.hostingAuthExpired.useValue();

  useEffect(() => {
    let cancelled = false;
    async function read() {
      const [isExpired, authToken, hostingUserId] = await Promise.all([
        db.hostingAuthExpired.getValue(),
        db.hostingAuthToken.getValue(),
        db.hostingUserId.getValue(),
      ]);
      if (cancelled) {
        return;
      }
      if (isExpired) {
        setReadState('expired');
      } else if (!authToken || !hostingUserId) {
        setReadState('missing');
      } else {
        setReadState('valid');
      }
    }
    read().catch(() => {
      if (!cancelled) {
        setReadState('missing');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The credentials themselves are only read once, on mount: they change at
  // login and logout, both of which tear this tree down anyway. Expiry is the
  // one transition that happens underneath a live screen.
  return readState === 'valid' && expired ? 'expired' : readState;
}
