import {
  browserWalletRequest,
  type WalletView,
} from '@tloncorp/api/client/browserWallet';
import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/api';
import { useQuery } from '@tanstack/react-query';
import { useBotSettingsIds } from '../settings/bot/useBotSettingsData';
import { normalizeMoonName } from '../settings/bot/helpers';
import { walletFinished as finished } from './browserPaymentPresentation';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { isWeb } from 'tamagui';

const logger = createDevLogger('BrowserWallet', true);

export function useBrowserWallet(requestId: string, open = true) {
  const { ship } = useBotSettingsIds();
  const moon = useQuery({
    queryKey: ['tlonbot', 'moon', ship],
    queryFn: () => api.getTlawnMoon(ship),
    enabled: !!ship,
    retry: false,
  });
  const botMoon = moon.data ? normalizeMoonName(moon.data, ship) : '';
  const [view, setView] = useState<WalletView>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const request = useCallback(
    async (
      operation: 'view' | 'approve' | 'cancel' = 'view',
      body?: { confirmed: true; payment_method_id?: string },
      signal?: AbortSignal
    ) => {
      const next = await browserWalletRequest(
        botMoon,
        requestId,
        operation,
        body,
        signal
      );
      if (!signal?.aborted) setView(next);
      return next;
    },
    [requestId, botMoon]
  );
  const perform = useCallback(
    async (
      operation: 'view' | 'approve' | 'cancel' = 'view',
      body?: { confirmed: true; payment_method_id?: string }
    ) => {
      setBusy(true);
      setError('');
      try {
        return await request(operation, body);
      } catch (e) {
        logger.trackError('wallet_request_failed', { operation });
        setError(e instanceof Error ? e.message : 'Wallet request failed.');
      } finally {
        setBusy(false);
      }
    },
    [request]
  );
  useEffect(() => {
    if (!botMoon) return;
    logger.trackEvent('wallet_request_viewed', { retry: refresh > 0 });
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await request('view', undefined, controller.signal);
        setError('');
        if (finished.has(next.status)) return;
      } catch {
        if (!controller.signal.aborted) {
          logger.trackError('wallet_refresh_failed');
          setError('Unable to refresh this wallet request. You can try again.');
        }
        return;
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 4000);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [request, refresh, botMoon, open]);
  const opening = useRef(false);
  const openProvider = async () => {
    if (opening.current || !view?.action || finished.has(view.status)) return;
    opening.current = true;
    setError('');
    try {
      if (view.expires_at <= Date.now())
        throw new Error(
          'This payment request has expired. Check status for details.'
        );
      const url = new URL(view.action.url);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('Invalid Link action.');
      if (isWeb) {
        const popup = window.open(url.href, '_blank');
        if (!popup) throw new Error('Allow pop-ups, then open Link again.');
        popup.opener = null;
      } else {
        await Linking.openURL(url.href);
      }
    } catch (e) {
      logger.trackError('wallet_link_open_failed');
      setError(e instanceof Error ? e.message : 'Unable to open Link.');
    } finally {
      opening.current = false;
    }
  };
  return {
    view,
    error: moon.isError ? 'Couldn’t connect to your bot. Try again.' : error,
    busy,
    onApprove: (id?: string) =>
      void perform('approve', {
        confirmed: true,
        ...(id ? { payment_method_id: id } : {}),
      }),
    onOpenLink: () => void openProvider(),
    onRetry: () => {
      setError('');
      void moon.refetch();
      setRefresh((value) => value + 1);
    },
    onCancel: () => void perform('cancel'),
  };
}
