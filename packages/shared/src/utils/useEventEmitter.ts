import {
  EventMapForEmitter,
  TypedEventEmitter,
} from '@tloncorp/api/lib/EventEmitter';
import { useCallback, useEffect, useState } from 'react';

export function useEventEmitter<
  Emitter extends TypedEventEmitter,
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
