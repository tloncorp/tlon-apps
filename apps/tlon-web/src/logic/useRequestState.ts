import { useCallback, useState } from 'react';

const READY = 'READY';
const FAILED = 'FAILED';
const PENDING = 'PENDING';

type RequestState = typeof READY | typeof FAILED | typeof PENDING;

export default function useRequestState() {
  const [requestState, setRequestState] = useState<RequestState>(READY);
  const setReady = useCallback(() => setRequestState(READY), []);
  const setFailed = useCallback(() => setRequestState(FAILED), []);
  const setPending = useCallback(() => setRequestState(PENDING), []);

  return {
    isFailed: requestState === FAILED,
    isPending: requestState === PENDING,
    isReady: requestState === READY,
    setFailed,
    setPending,
    setReady,
  };
}
