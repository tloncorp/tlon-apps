import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import * as api from '@tloncorp/api';
import { BrowserOwnerRequestError } from '@tloncorp/api/client/browserOwnerSession';
import {
  getVaultLogin,
  listVaultLogins,
  removeVaultLogin,
  type VaultLogin,
} from '@tloncorp/api/client/browserVaultManagement';
import { createDevLogger } from '@tloncorp/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { KERNEL_SERVICE_ORIGIN } from '../../../lib/envVars';
import { normalizeMoonName } from '../bot/helpers';

const logger = createDevLogger('SecureVault', false);
const origin = KERNEL_SERVICE_ORIGIN;

export function useSecureVault(ship: string) {
  const focused = useIsFocused();
  const client = useQueryClient();
  const [selected, setSelected] = useState<VaultLogin | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const removePending = useRef(false);
  useFocusEffect(useCallback(() => () => setSelected(null), []));
  const service = useQuery({
    queryKey: ['tlonbot', 'browser-service', ship],
    queryFn: () => api.getTlawnBrowserService(ship),
    enabled: !!ship && focused,
    retry: false,
  });
  const moon = useQuery({
    queryKey: ['tlonbot', 'moon', ship],
    queryFn: () => api.getTlawnMoon(ship),
    enabled: !!ship && focused,
    retry: false,
  });
  const kernel =
    (service.data?.active ?? service.data?.browserService) === 'kernel';
  const botMoon = moon.data ? normalizeMoonName(moon.data, ship) : '';
  const ready = kernel && !!botMoon && !!origin;
  const listKey = ['secure-vault', ship, origin];
  const list = useQuery({
    queryKey: listKey,
    enabled: ready && focused,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const result = await listVaultLogins(botMoon, signal);
        logger.trackEvent('Secure Vault Listed');
        return result;
      } catch (error) {
        if (!signal.aborted) logger.trackError('Secure Vault list failed');
        throw error;
      }
    },
  });
  const detail = useQuery({
    queryKey: ['secure-vault-detail', ship, origin, selected?.key],
    enabled: ready && focused && !!selected,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const result = await getVaultLogin(botMoon, selected!.key, signal);
        logger.trackEvent('Secure Vault Login Viewed');
        return result;
      } catch (error) {
        if (!signal.aborted) logger.trackError('Secure Vault detail failed');
        throw error;
      }
    },
  });
  const select = useCallback((login: VaultLogin | null) => {
    setRemoveError(undefined);
    setSelected(login);
  }, []);
  const close = useCallback(() => {
    if (!removePending.current) select(null);
  }, [select]);
  const remove = useCallback(async () => {
    if (!selected || removePending.current) return;
    removePending.current = true;
    setRemoving(true);
    setRemoveError(undefined);
    try {
      await removeVaultLogin(botMoon, selected.key);
      await client.cancelQueries({ queryKey: ['secure-vault', ship, origin] });
      client.setQueryData<VaultLogin[]>(
        ['secure-vault', ship, origin],
        (items) => items?.filter((item) => item.key !== selected.key)
      );
      client.removeQueries({
        queryKey: ['secure-vault-detail', ship, origin, selected.key],
      });
      setSelected(null);
      logger.trackEvent('Secure Vault Login Removed');
    } catch (error) {
      logger.trackError('Secure Vault removal failed');
      setRemoveError(
        error instanceof BrowserOwnerRequestError && error.status === 404
          ? 'This login is no longer in your vault. Close this sheet and refresh the list.'
          : 'Couldn’t confirm removal. Try again.'
      );
    }
    removePending.current = false;
    setRemoving(false);
  }, [selected, botMoon, client, ship]);
  const { refetch: refreshService } = service;
  const { refetch: refreshMoon } = moon;
  const { refetch: refreshList } = list;
  const refresh = useCallback(() => {
    void refreshService();
    void refreshMoon();
    if (ready) void refreshList();
  }, [refreshService, refreshMoon, refreshList, ready]);
  const notice =
    service.isError || moon.isError
      ? 'Couldn’t connect to your bot. Try again.'
      : service.isSuccess && !kernel
        ? 'Secure Vault is available for bots using Kernel.'
        : !origin
          ? 'Secure Vault isn’t available in this build yet.'
          : moon.isSuccess && !botMoon
            ? 'Your bot isn’t ready yet. Try again.'
            : undefined;
  return {
    list,
    detail,
    selected,
    select,
    close,
    remove,
    removing,
    removeError,
    refresh,
    notice,
    loading: !notice && (service.isPending || moon.isPending || list.isPending),
  };
}
