import { createDevLogger } from '@tloncorp/shared';
import { type ComponentRef, type ReactNode, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useBrowserPreviewVisible } from './useBrowserPreviewVisible';
import {
  fetchSecureEntryState,
  rememberSecureEntry,
  secureEntryCache,
  secureEntryKey,
} from './browserSecureEntryState';

const logger = createDevLogger('BrowserSecureEntryAction', false);
export function BrowserSecureEntryAction({
  viewerUrl,
  enabled,
  children,
}: {
  viewerUrl: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const { value: cache, isLoading } = secureEntryCache.useStorageItem();
  const state = cache?.[secureEntryKey(viewerUrl)]?.state;
  const visible = useBrowserPreviewVisible(ref, enabled && !state);
  useEffect(() => {
    if (!visible || state || isLoading) return;
    let controller: AbortController;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let reported = false;
    const refresh = async () => {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const next = await fetchSecureEntryState(viewerUrl, controller.signal);
        if (disposed) return;
        if (next) {
          await rememberSecureEntry(viewerUrl, next);
          return;
        }
      } catch {
        if (!disposed && !reported) {
          logger.trackError('Secure entry status could not load');
          reported = true;
        }
      } finally {
        clearTimeout(timeout);
      }
      if (!disposed) timer = setTimeout(refresh, 30000);
    };
    void refresh();
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
    };
  }, [visible, state, isLoading, viewerUrl]);
  if (state || isLoading) return null;
  return <View ref={ref}>{children}</View>;
}
