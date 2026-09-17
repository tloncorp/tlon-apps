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
  const [state, setState] = useState<HostingSessionState>('checking');

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
        setState('expired');
      } else if (!authToken || !hostingUserId) {
        setState('missing');
      } else {
        setState('valid');
      }
    }
    read().catch(() => {
      if (!cancelled) {
        setState('missing');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
