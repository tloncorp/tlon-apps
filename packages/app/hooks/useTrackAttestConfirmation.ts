import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';

export function useTrackAttestConfirmation(attest: db.Verification) {
  const [confirming, setConfirming] = useState(false);
  const [flag, setFlag] = useState(false);

  const [didError, setDidError] = useState(false);

  useEffect(() => {
    if (attest.status === 'pending') {
      if (confirming && !flag) {
        setFlag(true);
      }
    }
    if (attest.status === 'pending' && confirming && flag) {
      setDidError(true);
      setConfirming(false);
      setFlag(false);
    }
  }, [attest.status, confirming, flag]);

  const startRequest = useCallback(() => {
    setConfirming(true);
    setDidError(false);
    setFlag(false);
  }, []);

  return {
    startRequest,
    didError,
  };
}
