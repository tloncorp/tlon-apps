import { DependencyList, useLayoutEffect, useMemo, useRef } from 'react';

export interface LifecyclePermit {
  isCurrent: () => boolean;
  capture: () => () => boolean;
}

/** Authority belongs to a committed visit, never to a reusable channel ID. */
export function useLifecyclePermit(
  dependencies: DependencyList,
  enabled = true
): LifecyclePermit {
  const committed = useRef<object | null>(null);
  const scope = useMemo(
    () => ({ activation: { active: false, retired: false } }),
    // The caller declares the semantic lifetime, like an effect dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...dependencies, enabled]
  );

  useLayoutEffect(() => {
    // Strict Mode's second setup owns a new activation. Previously captured
    // work stays retired even though React reuses this render's callbacks.
    if (scope.activation.retired) {
      scope.activation = { active: false, retired: false };
    }
    const activation = scope.activation;
    activation.active = enabled;
    committed.current = scope;
    return () => {
      activation.active = false;
      activation.retired = true;
      if (committed.current === scope) committed.current = null;
    };
  }, [scope, enabled]);

  return useMemo(
    () => ({
      isCurrent: () => committed.current === scope && scope.activation.active,
      capture: () => {
        // A child layout effect may capture before this parent's setup. It
        // becomes usable only after that exact activation commits, and can
        // never become usable again after its cleanup.
        if (scope.activation.retired && committed.current === null) {
          // Strict Mode repeats child layout setup before parent setup. Reserve
          // the next activation without granting it authority before commit.
          scope.activation = { active: false, retired: false };
        }
        const activation = scope.activation;
        return () =>
          committed.current === scope &&
          scope.activation === activation &&
          activation.active &&
          !activation.retired;
      },
    }),
    [scope]
  );
}
