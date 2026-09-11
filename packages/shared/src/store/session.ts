import { ChannelStatus } from '@tloncorp/api/http-api';
import { useSyncExternalStore } from 'react';

export type SyncPhase = 'init' | 'high' | 'low' | 'ready';

// The startup desk-version probe is in flight, or has found the ship's %groups
// desk too old to talk to. Startup is blocked in both states.
export type DeskGate = {
  status: 'probing' | 'incompatible';
  current: string | null;
  minimum: string;
  // Whether the gated sync was a recovery run (subscriptions already live), so
  // a retry can resume with the same alreadySubscribed semantics.
  subscribed: boolean;
};

// `undefined` means the probe hasn't reported in this session yet — which is
// not the same as compatible, so nothing may assume a usable desk until this
// says 'ok'.
export type DeskCompatibility = { status: 'ok' } | DeskGate;

export type Session = {
  startTime?: number;
  channelStatus?: ChannelStatus;
  phase?: SyncPhase;
  isSyncing?: boolean;
  deskCompat?: DeskCompatibility;
};

// Session — time when subscriptions were first initialized after which we can assume
// all new events will be heard
let session: Session | null = null;
type SessionListener = (session: Session | null) => void;
const sessionListeners: SessionListener[] = [];

export function getSession() {
  return session;
}

export function triggerSessionListeners() {
  sessionListeners.forEach((listener) => listener(session));
}

export function updateSession(newSession: Partial<Session> | null) {
  session = newSession ? { ...session, ...newSession } : null;
  triggerSessionListeners();
}

export function setSession(newSession: Session) {
  session = newSession;
  triggerSessionListeners();
}

export function subscribeToSession(listener: SessionListener) {
  sessionListeners.push(listener);
  return () => {
    sessionListeners.splice(sessionListeners.indexOf(listener), 1);
  };
}

export function useCurrentSession() {
  return useSyncExternalStore(subscribeToSession, getSession);
}

// Initialized Client — whether the client has been initialized
let initializedClient: boolean = false;
type InitializedClientListener = (initialized: boolean) => void;
const initializedClientListeners: InitializedClientListener[] = [];

export function getInitializedClient() {
  return initializedClient;
}

// A token for the current client's lifetime. Long-running work captures it and
// checks it again before writing anything back, so an answer that arrives after
// a logout — or after a re-login to the same ship, which `internalConfigureClient`
// serves with the same Urbit object and the same ship name — can be told apart
// from one that still belongs to the live login.
let clientGeneration = 0;

export function getClientGeneration() {
  return clientGeneration;
}

export function updateInitializedClient(newValue: boolean) {
  // configureClient and removeClient are the only callers, so this is the one
  // place the client's lifetime changes.
  clientGeneration += 1;
  initializedClient = newValue;
  initializedClientListeners.forEach((listener) => listener(newValue));
}

function subscribeToInitializedClient(listener: InitializedClientListener) {
  initializedClientListeners.push(listener);
  return () => {
    initializedClientListeners.splice(
      initializedClientListeners.indexOf(listener),
      1
    );
  };
}

export function useInitializedClient() {
  return useSyncExternalStore(
    subscribeToInitializedClient,
    getInitializedClient
  );
}

export function useDeskCompatibility() {
  const currentSession = useCurrentSession();
  return currentSession?.deskCompat;
}

/**
 * Whether startup is blocked on the desk — either still probing, or already
 * refused. Anything that would talk to the desk has to wait for this to be
 * false *and* for a verdict to exist.
 */
export function isDeskGated(
  deskCompat?: DeskCompatibility
): deskCompat is DeskGate {
  return deskCompat != null && deskCompat.status !== 'ok';
}

/**
 * Whether the startup probe is still running with no verdict yet. `current` is
 * null only in that state — an incompatible verdict always carries the version
 * it read — so the shell can hold a loading state here instead of flashing a
 * notice that has no version to report.
 */
export function isDeskProbePending(deskCompat?: DeskCompatibility) {
  return (
    isDeskGated(deskCompat) &&
    deskCompat.status === 'probing' &&
    deskCompat.current === null
  );
}

/**
 * Whether the desk-outdated notice belongs on screen. A retry from the notice
 * goes back to 'probing' but keeps the version it found, so the notice stays up
 * with its retry action busy rather than blinking out.
 */
export function shouldShowDeskNotice(
  deskCompat?: DeskCompatibility
): deskCompat is DeskGate {
  return isDeskGated(deskCompat) && !isDeskProbePending(deskCompat);
}

export function useIsSyncing() {
  const currentSession = useCurrentSession();
  return currentSession?.isSyncing ?? true;
}

export function useConnectionStatus() {
  const currentSession = useCurrentSession();
  const initializedClient = useInitializedClient();

  if (!initializedClient) {
    return 'Idle';
  }

  if (!currentSession) {
    return 'Connecting';
  }

  if (currentSession.channelStatus === 'reconnecting') {
    return 'Reconnecting';
  }

  if (['active', 'reconnected'].includes(currentSession.channelStatus ?? '')) {
    return 'Connected';
  }

  return 'Connecting';
}
