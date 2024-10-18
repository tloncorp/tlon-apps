import { useSyncExternalStore } from 'react';

import { ChannelStatus } from '../http-api';

export type Session = { startTime?: number; channelStatus?: ChannelStatus };

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

function subscribeToSession(listener: SessionListener) {
  sessionListeners.push(listener);
  return () => {
    sessionListeners.splice(sessionListeners.indexOf(listener), 1);
  };
}

export function useCurrentSession() {
  return useSyncExternalStore(subscribeToSession, getSession);
}

// Syncing — whether our initial fetching logic is currently running
let isSyncing: boolean = false;
type SyncListener = (syncing: boolean) => void;
const syncListeners: SyncListener[] = [];

export function getSyncing() {
  return isSyncing;
}

export function updateIsSyncing(newValue: boolean) {
  isSyncing = newValue;
  syncListeners.forEach((listener) => listener(newValue));
}

function subscribeToIsSyncing(listener: SyncListener) {
  syncListeners.push(listener);
  return () => {
    syncListeners.splice(syncListeners.indexOf(listener), 1);
  };
}

export function useSyncing() {
  return useSyncExternalStore(subscribeToIsSyncing, getSyncing);
}

// Initialized Client — whether the client has been initialized
let initializedClient: boolean = false;
type InitializedClientListener = (initialized: boolean) => void;
const initializedClientListeners: InitializedClientListener[] = [];

export function getInitializedClient() {
  return initializedClient;
}

export function updateInitializedClient(newValue: boolean) {
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

export function useConnectionStatus() {
  const currentSession = useCurrentSession();
  const syncing = useSyncing();
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

  if (syncing) {
    return 'Syncing';
  }

  if (['active', 'reconnected'].includes(currentSession.channelStatus ?? '')) {
    return 'Connected';
  }

  return 'Connecting';
}
