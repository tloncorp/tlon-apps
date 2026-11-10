import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { BrowserOwnerRequestError } from '@tloncorp/api/client/browserOwnerSession';

import type { RootStackParamList } from '../../navigation/types';
import { useBotSettingsIds } from './bot/useBotSettingsData';
import { SecureVaultView, VaultLoginSheet } from './vault/SecureVaultView';
import { useSecureVault } from './vault/useSecureVault';

type Props = NativeStackScreenProps<RootStackParamList, 'SecureVault'>;
export function SecureVaultScreen({ navigation }: Props) {
  const { ship } = useBotSettingsIds();
  const back = useCallback(() => navigation.goBack(), [navigation]);
  return <OwnerVault key={ship} ship={ship} onBack={back} />;
}
function OwnerVault({ ship, onBack }: { ship: string; onBack: () => void }) {
  const vault = useSecureVault(ship);
  const detailError = vault.detail.isError
    ? vault.detail.error instanceof BrowserOwnerRequestError &&
      vault.detail.error.status === 404
      ? 'This login is no longer in your vault.'
      : 'Couldn’t load this login. Try again.'
    : undefined;
  return (
    <SecureVaultView
      logins={vault.list.data}
      loading={vault.loading}
      error={
        vault.notice ??
        (vault.list.isError
          ? 'Couldn’t load your vault. Try again.'
          : undefined)
      }
      onRefresh={vault.refresh}
      onSelect={vault.select}
      onBack={onBack}
    >
      {vault.selected && (
        <VaultLoginSheet
          key={vault.selected.key}
          login={vault.selected}
          detail={vault.detail.data}
          loading={vault.detail.isPending}
          error={detailError}
          removing={vault.removing}
          removeError={vault.removeError}
          onRetry={() => void vault.detail.refetch()}
          onClose={vault.close}
          onRemove={() => void vault.remove()}
        />
      )}
    </SecureVaultView>
  );
}
