import { createDevLogger } from '@tloncorp/shared';
import { createStorageItem } from '@tloncorp/shared/db';
import { trustedBrowserViewerUrl } from './browserCredentialHandoff';

const logger = createDevLogger('BrowserSecureEntryState', false);
export type SecureEntryState = 'used' | 'expired' | 'ended';
export const secureEntryMessages: Record<SecureEntryState, string> = {
  used: 'This entry has already been submitted.',
  expired: 'This secure-entry request has expired.',
  ended: 'This secure-entry request has ended.',
};
export const secureEntryCache = createStorageItem<Record<
  string,
  {
    state: SecureEntryState;
    checkedAt: number;
  }
> | null>({ key: 'browserSecureEntryCache', defaultValue: null });

export function secureEntryKey(url: string) {
  const parsed = new URL(url);
  return parsed.origin + parsed.pathname;
}
export async function rememberSecureEntry(
  url: string,
  state: SecureEntryState
) {
  try {
    await secureEntryCache.setValue((current) =>
      Object.fromEntries(
        Object.entries({
          ...current,
          [secureEntryKey(url)]: { state, checkedAt: Date.now() },
        })
          .sort((a, b) => b[1].checkedAt - a[1].checkedAt)
          .slice(0, 1000)
      )
    );
  } catch {
    logger.trackError('Secure entry status could not be saved');
  }
}

// Read receipts only: opening /credentials would prepare a form and supersede field handles.
export async function fetchSecureEntryState(
  url: string,
  signal: AbortSignal
): Promise<SecureEntryState | undefined> {
  const viewer = new URL(trustedBrowserViewerUrl(url));
  viewer.pathname = viewer.pathname.replace('/s/', '/credential-result/');
  viewer.search = '';
  viewer.hash = '';
  const response = await fetch(viewer.toString(), {
    signal,
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
  });
  if (response.status === 401 || response.status === 410) return 'expired';
  // Older services and requests not yet opened may have no receipt.
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Secure entry status is unavailable.');
  const body = await response.json();
  if (body.status === 'filled') return 'used';
  if (body.status === 'expired' || body.outcome === 'expired') return 'expired';
  if (['failed', 'cancelled', 'released', 'unknown'].includes(body.status))
    return 'ended';
  return undefined;
}
