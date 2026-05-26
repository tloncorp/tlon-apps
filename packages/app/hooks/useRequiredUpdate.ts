import { useQuery } from '@tanstack/react-query';
import { createDevLogger, isVersionBelow } from '@tloncorp/shared';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { INVITE_SERVICE_ENDPOINT } from '../constants';

const POLL_INTERVAL_MS = 10 * 60 * 1000;
const logger = createDevLogger('useRequiredUpdate', false);

type PlatformKey = 'ios' | 'android';

interface MinVersionResponse {
  ios?: { minVersion?: string };
  android?: { minVersion?: string };
}

async function fetchMinVersion(endpoint: string): Promise<MinVersionResponse> {
  const response = await fetch(`${endpoint}/minVersion`);
  if (!response.ok) {
    throw new Error(`minVersion request failed: ${response.status}`);
  }
  return response.json();
}

function currentPlatform(): PlatformKey | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

export function useRequiredUpdate(): boolean {
  const platform = currentPlatform();
  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
  const enabled = !!platform && !!INVITE_SERVICE_ENDPOINT;

  const query = useQuery({
    queryKey: ['required-update', INVITE_SERVICE_ENDPOINT],
    queryFn: () => fetchMinVersion(INVITE_SERVICE_ENDPOINT),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: POLL_INTERVAL_MS,
    enabled,
  });

  if (!platform || !query.data) return false;

  const minVersion = query.data[platform]?.minVersion;
  if (!minVersion) return false;

  const required = isVersionBelow(currentVersion, minVersion);
  if (required) {
    logger.log('Required update detected', { currentVersion, minVersion });
  }
  return required;
}
