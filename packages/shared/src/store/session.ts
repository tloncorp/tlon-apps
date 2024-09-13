import { useSyncExternalStore } from 'react';

export type Session = { startTime: number };

// Session — time when subscriptions were first initialized and we can assume
// all new events have been heard
let session: Session | null = null;
type SessionListener = (session: Session | null) => void;
const sessionListeners: SessionListener[] = [];

export function getSession() {
  return session;
}

export function updateSession(newSession: Session | null) {
  session = newSession;
  sessionListeners.forEach((listener) => listener(session));
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

// Syncing — whether our start sync logic is currently running
let isSyncing: boolean = false;
type SyncListener = (syncing: boolean) => void;
const syncListeners: SyncListener[] = [];

export function getSyncing() {
  return isSyncing;
}

export function updateIsSyncing(newValue: boolean) {
  console.log(`updating is syncing`, newValue);
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

export function useConnectionStatus() {
  const currentSession = useCurrentSession();
  const syncing = useSyncing();

  console.log(`con status render`, currentSession, syncing);

  if (!currentSession) {
    return 'Connecting';
  }

  if (syncing) {
    return 'Syncing';
  }

  return 'Connected';
}
