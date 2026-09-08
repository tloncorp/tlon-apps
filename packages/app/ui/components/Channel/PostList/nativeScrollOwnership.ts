/** A committed renderer owns one intent revision, independently of proximity. */
export type NativeScrollMode = 'follow' | 'read';
export type NativeScrollOwnershipSnapshot = {
  active: boolean;
  revision: number;
  mode: NativeScrollMode;
  commandPending: boolean;
};
export function createNativeScrollOwnership(initialMode: NativeScrollMode) {
  let active = false;
  let revision = 0;
  let mode = initialMode;
  let gesture = false;
  let commandPending = false;
  let snapshot: NativeScrollOwnershipSnapshot = {
    active,
    revision,
    mode,
    commandPending,
  };
  const listeners = new Set<() => void>();
  const requests = new Set<() => void>();
  const validateRequests = () => {
    for (const validate of [...requests]) validate();
  };
  const publish = () => {
    validateRequests();
    if (
      snapshot.active === active &&
      snapshot.revision === revision &&
      snapshot.mode === mode &&
      snapshot.commandPending === commandPending
    )
      return;
    snapshot = { active, revision, mode, commandPending };
    listeners.forEach((listener) => listener());
  };
  const setMode = (next: NativeScrollMode) => {
    if (mode !== next) {
      mode = next;
      publish();
    }
  };
  return {
    validateRequests,
    trackRequest(
      request: Promise<void>,
      isCurrent: () => boolean,
      cancel: () => void
    ) {
      const validate = () => {
        if (isCurrent()) return;
        requests.delete(validate);
        cancel();
      };
      requests.add(validate);
      const release = () => {
        requests.delete(validate);
      };
      void request.then(release, release);
      validate();
    },
    activate() {
      active = true;
      publish();
    },
    suspend() {
      active = false;
      gesture = false;
      commandPending = false;
      revision++;
      setMode('read');
      publish();
    },
    dispose() {
      active = false;
      gesture = false;
      commandPending = false;
      revision++;
      publish();
    },
    capture() {
      const captured = revision;
      return () => active && revision === captured;
    },
    navigate(next: NativeScrollMode) {
      if (!active) return () => false;
      const captured = ++revision;
      gesture = false;
      commandPending = true;
      setMode(next);
      publish();
      return () => active && revision === captured;
    },
    finishNavigation() {
      if (!active) return false;
      if (!commandPending) return true;
      const captured = revision;
      commandPending = false;
      publish();
      return active && revision === captured;
    },
    beginGesture() {
      if (!active) return;
      revision++;
      gesture = true;
      commandPending = false;
      setMode('read');
      publish();
    },
    settleGesture(distanceFromBottom: number, hasNewerPosts: boolean) {
      if (!active || !gesture) return;
      // Native momentum-end may follow drag-end. Only gesture callbacks can
      // reacquire FOLLOW; layout/content proximity changes cannot do so.
      if (Number.isFinite(distanceFromBottom)) {
        setMode(!hasNewerPosts && distanceFromBottom <= 1 ? 'follow' : 'read');
      }
    },
    getMode: () => mode,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Terminal alignment failure after the dependency exhausted its own retries. */
export function isNativeScrollUnalignedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'LEGEND_SCROLL_UNALIGNED'
  );
}

/** Retry an ordinary measurement race once while its initiating intent owns it. */
export function runOwnedNativeScroll(
  isCurrent: () => boolean,
  scroll: () => Promise<void> | undefined,
  schedule: (callback: () => void) => unknown = requestAnimationFrame,
  onSettled?: () => void,
  onFailure?: (error: unknown) => void
) {
  const attempt = () => {
    if (!isCurrent()) return Promise.resolve();
    try {
      return scroll() ?? Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };
  const finish = () => {
    if (isCurrent()) onSettled?.();
  };
  const fail = (error: unknown) => {
    if (isCurrent()) onFailure?.(error);
  };
  void attempt().then(finish, (error: unknown) => {
    if (!isCurrent()) return;
    if (isNativeScrollUnalignedError(error)) {
      fail(error);
      return;
    }
    schedule(() => {
      void attempt().then(finish, fail);
    });
  });
}

/** LegendList already removes its native trailing inset from viewPosition. */
export function nativeAnchorViewOffset(
  top: number,
  bottom: number,
  viewPosition: number,
  nativeBottomInset: boolean,
  lastRowFooterSize = 0
) {
  // LegendList adds the footer to every last-item target, including centered
  // and top-aligned targets. Cancel that addition for message placement.
  return (
    top * (1 - viewPosition) -
    (nativeBottomInset ? 0 : bottom * viewPosition) +
    lastRowFooterSize
  );
}
