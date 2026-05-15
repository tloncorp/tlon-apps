import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect } from 'react';

const logger = createDevLogger('useMarkMatchesSeen', false);

/**
 * Clears the "new match" pill markers when the host screen unmounts —
 * the user has had a chance to see the matches. Use on any screen that
 * surfaces the pills (Contacts screen on mobile, profile drawer on
 * desktop).
 */
export function useMarkMatchesSeen() {
  useEffect(() => {
    return () => {
      db.clearContactsMatchedAt().catch((err) => {
        logger.trackError('Failed to clear contact match pills', {
          error: err instanceof Error ? err : undefined,
        });
      });
    };
  }, []);
}
