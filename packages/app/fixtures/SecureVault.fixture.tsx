import type { VaultLoginDetail } from '@tloncorp/api/client/browserVaultManagement';
import { useState } from 'react';

import {
  SecureVaultView,
  VaultLoginSheet,
} from '../features/settings/vault/SecureVaultView';
import { FixtureWrapper } from './FixtureWrapper';

const wikipedia: VaultLoginDetail = {
  key: 'wikipedia',
  id: 'fixture-wikipedia',
  revision: 1,
  origins: ['https://www.wikipedia.org'],
  fields: [
    {
      name: 'email',
      type: 'email',
      sensitive: false,
      hasValue: true,
      value: 'alex@example.com',
    },
    { name: 'password', type: 'password', sensitive: true, hasValue: true },
  ],
};
const chess: VaultLoginDetail = {
  ...wikipedia,
  key: 'chess',
  id: 'fixture-chess',
  origins: ['https://www.chess.com'],
};

function Demo({
  empty = false,
  error = false,
  loading = false,
  removeFails = false,
}: {
  empty?: boolean;
  error?: boolean;
  loading?: boolean;
  removeFails?: boolean;
}) {
  const [logins, setLogins] = useState(empty ? [] : [wikipedia, chess]);
  const [selected, setSelected] = useState<VaultLoginDetail | null>(null);
  const [removeError, setRemoveError] = useState<string>();
  return (
    <FixtureWrapper fillWidth fillHeight>
      <SecureVaultView
        logins={logins}
        loading={loading}
        error={error ? 'Couldn’t load your vault. Try again.' : undefined}
        onRefresh={() => setLogins([wikipedia, chess])}
        onSelect={(login) => {
          setRemoveError(undefined);
          setSelected(logins.find((item) => item.key === login.key)!);
        }}
        onBack={() => {}}
      >
        {selected && (
          <VaultLoginSheet
            login={selected}
            detail={selected}
            loading={false}
            removeError={removeError}
            onRetry={() => {}}
            onClose={() => setSelected(null)}
            onRemove={() => {
              if (removeFails) {
                setRemoveError('Couldn’t confirm removal. Try again.');
                return;
              }
              setLogins((items) =>
                items.filter((item) => item.key !== selected.key)
              );
              setSelected(null);
            }}
          />
        )}
      </SecureVaultView>
    </FixtureWrapper>
  );
}
export default {
  SavedLogins: <Demo />,
  Empty: <Demo empty />,
  Loading: <Demo loading />,
  Unavailable: <Demo error />,
  RemovalFailure: <Demo removeFails />,
};
