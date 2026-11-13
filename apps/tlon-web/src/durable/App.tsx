import { BaseProviderStack } from '@tloncorp/app/provider/BaseProviderStack';
import { useMigrations } from '@tloncorp/app/lib/webDb';
import { startDurableSync } from '@tloncorp/shared/store/durableSync';
import { useEffect, useState } from 'react';
import { AppRoutes } from '../app';

export default function DurableApp() {
  const migrations = useMigrations();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!migrations.success) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    startDurableSync((error) => setError(error?.message ?? ''))
      .then((cleanup) => {
        if (disposed) cleanup();
        else {
          stop = cleanup;
          setReady(true);
        }
      })
      .catch((error) => setError(String(error)));
    return () => {
      disposed = true;
      stop?.();
    };
  }, [migrations.success]);
  return (
    <BaseProviderStack migrationState={migrations}>
      <div
        style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}
      >
        {error && (
          <div role="alert" style={{ padding: 8, color: '#a22' }}>
            {error}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {ready ? <AppRoutes /> : <p>Loading local conversations…</p>}
        </div>
      </div>
    </BaseProviderStack>
  );
}
