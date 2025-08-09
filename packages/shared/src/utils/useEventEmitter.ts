import { useCallback, useEffect, useState } from 'react';

import { EventEmitter, EventMapForEmitter } from './EventEmitter';

export function useEventEmitter<
  Emitter extends EventEmitter,
  E extends keyof EventMapForEmitter<Emitter>,
  State,
>(
  emitter: Emitter,
  eventName: E,
  buildNextState: (
    prevState: State,
    args: Parameters<EventMapForEmitter<Emitter>[E]>
  ) => State,
  initialState: State
): State {
  const [state, setState] = useState<State>(initialState);

  const eventListener = useCallback(
    (...args: Parameters<EventMapForEmitter<Emitter>[E]>) => {
      setState((prev) => buildNextState(prev, args));
    },
    [buildNextState]
  );

  useEffect(() => {
    emitter.on(eventName, eventListener);
    return () => {
      emitter.off(eventName, eventListener);
    };
  }, [emitter, eventName, eventListener]);

  return state;
}
