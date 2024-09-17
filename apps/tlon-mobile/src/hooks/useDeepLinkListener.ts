import { useBranch, useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { inviteShipWithLure } from '@tloncorp/app/lib/hostingApi';
import { trackError } from '@tloncorp/app/utils/posthog';
import { useEffect, useRef } from 'react';

export const useDeepLinkListener = () => {
  const isInvitingRef = useRef(false);
  const { ship } = useShip();
  const signupParams = useSignupParams();
  const { clearLure, lure } = useBranch();

  // If lure is present, invite it and mark as handled
  useEffect(() => {
    if (ship && lure && !isInvitingRef.current) {
      (async () => {
        try {
          isInvitingRef.current = true;
          console.log(`inviting ship with lure`, ship, signupParams.lureId);
          await inviteShipWithLure({ ship, lure: signupParams.lureId });
        } catch (err) {
          console.error(
            '[useDeepLinkListener] Error inviting ship with lure:',
            err
          );
          if (err instanceof Error) {
            trackError(err);
          }
        } finally {
          clearLure();
          isInvitingRef.current = false;
        }
      })();
    }
  }, [ship, signupParams, clearLure, lure]);
};
