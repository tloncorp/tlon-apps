import { Text } from '@tloncorp/app/ui';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { runBackgroundSyncFromDebugButton } from '../lib/backgroundSync';

// Dev-only floating button that triggers a single background-sync run
// against the live JS bundle. Useful for verifying the bg-sync code
// path (lanyard discovery, match notifications, etc.) without waiting
// on iOS BGTaskScheduler heuristics or jumping into the Xcode debugger
// to fire `_simulateLaunchForTaskWithIdentifier:`. Mounted only when
// __DEV__ is true and EXPO_PUBLIC_DEBUG_BG_SYNC_BUTTON=true is set in
// .env.local — otherwise this returns null and tree-shakes out.
const ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_DEBUG_BG_SYNC_BUTTON === 'true';

export function DebugBackgroundSyncButton() {
  if (!ENABLED) return null;
  return <DebugBackgroundSyncButtonImpl />;
}

function DebugBackgroundSyncButtonImpl() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>(
    'idle'
  );

  const handlePress = useCallback(async () => {
    if (status === 'running') return;
    setStatus('running');
    try {
      await runBackgroundSyncFromDebugButton();
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.warn('[bg-sync-debug] trigger failed', err);
      setStatus('error');
    }
  }, [status]);

  const label =
    status === 'running'
      ? 'Syncing...'
      : status === 'done'
        ? 'Sync done'
        : status === 'error'
          ? 'Sync failed'
          : 'Run bg sync';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Run background sync"
      disabled={status === 'running'}
      onPress={handlePress}
      style={{
        position: 'absolute',
        right: 16,
        bottom: 36,
        zIndex: 1000,
        minHeight: 44,
        minWidth: 116,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        paddingHorizontal: 14,
        backgroundColor: status === 'error' ? '#B42318' : '#1D4ED8',
        opacity: status === 'running' ? 0.75 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      }}
    >
      <Text color="white" fontSize="$s" fontWeight="600">
        {label}
      </Text>
    </Pressable>
  );
}
