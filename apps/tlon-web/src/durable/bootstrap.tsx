import {
  DurableClient,
  configureDurableClient,
  type DurableGroup,
} from '@tloncorp/api/client/durable';
import { useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

import { AvatarPicker, type AvatarUpload } from './AvatarCropper';
import { allowDurableOrigin } from './localOnly';

// `server` is set for an account hosted somewhere other than this site, such
// as the Mac app's node.
type Identity = { id: string; name: string; token: string; server?: string };
const identitiesKey = 'slab.identities';
const activeKey = 'slab.activeIdentity';

export async function bootstrapDurable() {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const token = hash.get('session');
  const server = hash.get('server') ?? undefined;
  const manage = url.searchParams.has('identities');
  if (token) {
    url.hash = '';
    history.replaceState(null, '', url);
  }

  const identities = loadIdentities();
  const saved = identities.find(
    (identity) => identity.id === readStorage(activeKey)
  );
  let client: DurableClient | undefined;
  let error = '';
  if (token || (!manage && saved)) {
    try {
      client = token
        ? await openIdentity(token, server)
        : await openIdentity(saved!.token, saved!.server);
    } catch (cause) {
      error = String(cause);
    }
  }
  client ??= await chooseIdentity(identities, error);
  configureDurableClient(client);
  window.ship = client.bootstrap.user.contactId.slice(1);
  window.our = client.bootstrap.user.contactId;
  if (manage) {
    url.searchParams.delete('identities');
    history.replaceState(null, '', url);
  }
}

async function openIdentity(token: string, server?: string) {
  if (server) allowDurableOrigin(server);
  const client = new DurableClient(token, server);
  const { user } = await client.initialize();
  const saved = loadIdentities().filter((identity) => identity.id !== user.id);
  const identity: Identity = { id: user.id, name: user.name, token };
  if (server) identity.server = client.origin;
  writeStorage(identitiesKey, JSON.stringify([...saved, identity]));
  writeStorage(activeKey, user.id);
  return client;
}

function chooseIdentity(identities: Identity[], error: string) {
  const root = createRoot(document.getElementById('app')!);
  return new Promise<DurableClient>((resolve) => {
    root.render(
      <IdentityPicker
        identities={identities}
        initialError={error}
        onOpen={(client) => {
          root.unmount();
          resolve(client);
        }}
      />
    );
  });
}

function IdentityPicker({
  identities,
  initialError,
  onOpen,
}: {
  identities: Identity[];
  initialError: string;
  onOpen: (client: DurableClient) => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarUpload>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [exporting, setExporting] = useState<{
    identity: Identity;
    client: DurableClient;
    groups: DurableGroup[];
    selected: string[];
  }>();

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  function create(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const response = await fetch('/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...avatar }),
      });
      if (!response.ok) throw new Error(await response.text());
      const { token } = (await response.json()) as { token: string };
      onOpen(await openIdentity(token));
    });
  }

  async function selectExport(identity: Identity) {
    if (identity.server) allowDurableOrigin(identity.server);
    const client = new DurableClient(identity.token, identity.server);
    const { groups } = await client.initialize();
    const eligible = groups.filter(
      (group) =>
        group.groupId &&
        group.hosted !== false &&
        !group.unavailable &&
        !group.lobby &&
        (group.owner === identity.id ||
          group.memberRoles?.[identity.id]?.includes('admin'))
    );
    setExporting({
      identity,
      client,
      groups: eligible,
      selected: eligible
        .filter((group) => group.owner === identity.id)
        .map((group) => group.groupId!),
    });
  }

  return (
    <main
      style={{
        height: '100dvh',
        overflow: 'auto',
        display: 'grid',
        placeItems: 'center',
        background: 'Canvas',
        color: 'CanvasText',
        fontFamily: 'system-ui',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <section style={{ width: '100%', maxWidth: 400 }}>
        <h1>{exporting ? `Export ${exporting.identity.name}` : 'Tlon'}</h1>
        {error && <p role="alert">{error}</p>}
        {exporting ? (
          <>
            {exporting.groups.length > 0 && (
              <p>Choose groups to move with this account.</p>
            )}
            {exporting.groups.map((group) => {
              const id = group.groupId!;
              const checked = exporting.selected.includes(id);
              return (
                <label key={id} style={{ display: 'block', padding: '8px 0' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setExporting({
                        ...exporting,
                        selected: checked
                          ? exporting.selected.filter((key) => key !== id)
                          : [...exporting.selected, id],
                      })
                    }
                  />
                  {group.title}
                </label>
              );
            })}
            <p>
              Export pauses writes until the bundle is imported or the export is
              canceled.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await exporting.client.exportBundle(exporting.selected);
                  setExporting(undefined);
                })
              }
            >
              Download bundle
            </button>{' '}
            <button onClick={() => setExporting(undefined)}>Back</button>
          </>
        ) : (
          <>
            {identities.length > 0 && <h2>Identities</h2>}
            {identities.map((identity) => (
              <div
                key={identity.id}
                style={{ display: 'flex', gap: 8, marginBottom: 8 }}
              >
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () =>
                      onOpen(
                        await openIdentity(identity.token, identity.server)
                      )
                    )
                  }
                >
                  {identity.name}
                  {identity.server && ` (${new URL(identity.server).host})`}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void run(() => selectExport(identity))}
                >
                  Export account
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (identity.server) allowDurableOrigin(identity.server);
                      await new DurableClient(
                        identity.token,
                        identity.server
                      ).request('/export/restore', {});
                    })
                  }
                >
                  Restore here
                </button>
              </div>
            ))}
            <form
              onSubmit={create}
              style={{ marginTop: 24, display: 'grid', gap: 16 }}
            >
              {identities.length > 0 && (
                <h2 style={{ margin: 0 }}>New identity</h2>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <AvatarPicker
                  disabled={busy}
                  onChange={setAvatar}
                  onError={setError}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                  <label htmlFor="identity-name">Display name</label>
                  <input
                    id="identity-name"
                    required
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <span style={{ opacity: 0.7, fontSize: 13 }}>
                    {avatar
                      ? 'Click the picture to adjust it.'
                      : 'Add a profile picture to continue.'}
                  </span>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy || !name.trim() || !avatar}
                style={{ justifySelf: 'start' }}
              >
                New identity
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function loadIdentities(): Identity[] {
  try {
    return (
      JSON.parse(readStorage(identitiesKey) ?? '[]') as Identity[]
    ).filter(
      ({ id, name, token, server }) =>
        typeof id === 'string' &&
        typeof name === 'string' &&
        typeof token === 'string' &&
        (server === undefined || typeof server === 'string')
    );
  } catch {
    return [];
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The active client keeps the identity in memory for this tab.
  }
}
