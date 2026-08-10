import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  type BotCommandManifestPokeApi,
  SELF_CONTACT_SCRY_PATH,
  type SelfContactRead,
  maybePublishBotCommandManifest,
  publishBotCommandManifest,
  readBotCommandsValue,
  readSelfContact,
  syncBotCommandManifest,
} from './bot-command-manifest.js';
import { BOT_COMMANDS_CONTACT_KEY } from './commands-registry.js';

const manifestValue = JSON.stringify({
  v: 1,
  commands: [{ command: '/allow', title: 'Allow' }],
});

const selfContactWith = (value: unknown) => ({
  nickname: { type: 'text', value: 'Bot' },
  [BOT_COMMANDS_CONTACT_KEY]: value,
});

// A successful read of the given contact map.
const read = (contact: unknown): SelfContactRead => ({ ok: true, contact });

describe('readBotCommandsValue', () => {
  it('reads a well-formed text field', () => {
    expect(
      readBotCommandsValue(
        selfContactWith({ type: 'text', value: manifestValue })
      )
    ).toBe(manifestValue);
  });

  it('returns null for absent or wrong-shaped fields', () => {
    expect(
      readBotCommandsValue({ nickname: { type: 'text', value: 'Bot' } })
    ).toBeNull();
    expect(
      readBotCommandsValue(selfContactWith({ type: 'set', value: [] }))
    ).toBeNull();
    expect(
      readBotCommandsValue(selfContactWith({ type: 'text', value: 42 }))
    ).toBeNull();
    expect(readBotCommandsValue(selfContactWith(manifestValue))).toBeNull();
    expect(readBotCommandsValue(null)).toBeNull();
    expect(readBotCommandsValue('not-a-contact')).toBeNull();
  });
});

describe('publishBotCommandManifest', () => {
  it('pokes the manifest as a contact-action-1 self text field', async () => {
    const poke = vi.fn(async () => {});
    const api: BotCommandManifestPokeApi = { poke };

    await expect(publishBotCommandManifest(api, manifestValue)).resolves.toBe(
      'published'
    );
    expect(poke).toHaveBeenCalledWith({
      app: 'contacts',
      mark: 'contact-action-1',
      json: {
        self: {
          [BOT_COMMANDS_CONTACT_KEY]: { type: 'text', value: manifestValue },
        },
      },
    });
  });

  it('pokes null to clear the key (rollback/retirement)', async () => {
    const poke = vi.fn(async () => {});
    const api: BotCommandManifestPokeApi = { poke };

    await expect(publishBotCommandManifest(api, null)).resolves.toBe('cleared');
    expect(poke).toHaveBeenCalledWith({
      app: 'contacts',
      mark: 'contact-action-1',
      json: { self: { [BOT_COMMANDS_CONTACT_KEY]: null } },
    });
  });
});

describe('maybePublishBotCommandManifest', () => {
  it('publishes when the current value differs', async () => {
    const poke = vi.fn(async () => {});
    const api: BotCommandManifestPokeApi = { poke };

    await expect(
      maybePublishBotCommandManifest(
        api,
        read(selfContactWith({ type: 'text', value: '{"v":1,"commands":[]}' })),
        manifestValue
      )
    ).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('publishes when no manifest is currently advertised', async () => {
    const poke = vi.fn(async () => {});
    const api: BotCommandManifestPokeApi = { poke };

    await expect(
      maybePublishBotCommandManifest(
        api,
        read({ nickname: { type: 'text', value: 'Bot' } }),
        manifestValue
      )
    ).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('skips the poke when the value already matches', async () => {
    const poke = vi.fn(async () => {});
    const api: BotCommandManifestPokeApi = { poke };

    await expect(
      maybePublishBotCommandManifest(
        api,
        read(selfContactWith({ type: 'text', value: manifestValue })),
        manifestValue
      )
    ).resolves.toBe('unchanged');
    expect(poke).not.toHaveBeenCalled();
  });

  it('republishes over a wrong-shaped stored value', async () => {
    const poke = vi.fn(async () => {});
    const api: BotCommandManifestPokeApi = { poke };

    await expect(
      maybePublishBotCommandManifest(
        api,
        read(selfContactWith({ type: 'numb', value: '0x1' })),
        manifestValue
      )
    ).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(1);
  });
});

// B-3: a failed self-contact read is not evidence that the key is absent.
describe('failed self-contact reads', () => {
  it('skips the poke when the read failed', async () => {
    const poke = vi.fn(async () => {});
    const api: BotCommandManifestPokeApi = { poke };

    await expect(
      maybePublishBotCommandManifest(
        api,
        { ok: false, error: new Error('scry failed') },
        manifestValue
      )
    ).resolves.toBe('skipped');
    expect(poke).not.toHaveBeenCalled();
  });

  it('publishes when the read succeeded with an empty contact map', async () => {
    const poke = vi.fn(async () => {});
    const api: BotCommandManifestPokeApi = { poke };

    await expect(
      maybePublishBotCommandManifest(api, read({}), manifestValue)
    ).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('readSelfContact reports failure instead of an empty map', async () => {
    const failing = {
      scry: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    await expect(readSelfContact(failing)).resolves.toMatchObject({
      ok: false,
    });

    const ok = { scry: vi.fn(async () => ({})) };
    await expect(readSelfContact(ok)).resolves.toEqual({
      ok: true,
      contact: {},
    });
    expect(ok.scry).toHaveBeenCalledWith(SELF_CONTACT_SCRY_PATH);
  });
});

// B-4: reconnect catch-up. A boot publish that failed, or a key cleared while
// this process stayed alive, must not wait for a restart.
describe('syncBotCommandManifest', () => {
  const makeApi = (scryImpl: () => Promise<unknown>) => {
    const poke = vi.fn(async () => {});
    const scry = vi.fn(scryImpl);
    return { api: { poke, scry }, poke, scry };
  };

  it('re-reads the self-contact and publishes when it differs', async () => {
    const { api, poke, scry } = makeApi(async () => ({}));

    await expect(syncBotCommandManifest(api, manifestValue)).resolves.toBe(
      'published'
    );
    expect(scry).toHaveBeenCalledWith(SELF_CONTACT_SCRY_PATH);
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('re-reads and skips the poke when the value already matches', async () => {
    const { api, poke } = makeApi(async () =>
      selfContactWith({ type: 'text', value: manifestValue })
    );

    await expect(syncBotCommandManifest(api, manifestValue)).resolves.toBe(
      'unchanged'
    );
    expect(poke).not.toHaveBeenCalled();
  });

  it('skips (never throws) when the re-read fails', async () => {
    const { api, poke } = makeApi(async () => {
      throw new Error('ship unreachable');
    });

    await expect(syncBotCommandManifest(api, manifestValue)).resolves.toBe(
      'skipped'
    );
    expect(poke).not.toHaveBeenCalled();
  });

  it('reuses a supplied read instead of scrying again (boot path)', async () => {
    const { api, poke, scry } = makeApi(async () => ({}));

    await expect(
      syncBotCommandManifest(api, manifestValue, read({}))
    ).resolves.toBe('published');
    expect(scry).not.toHaveBeenCalled();
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('swallows a failing poke', async () => {
    const poke = vi.fn(async () => {
      throw new Error('poke nacked');
    });
    const api = { poke, scry: vi.fn(async () => ({})) };

    await expect(syncBotCommandManifest(api, manifestValue)).resolves.toBe(
      'skipped'
    );
  });
});

// The publisher above is exercised as a helper; nothing else binds it to the
// monitor's lifecycle. monitorTlonProvider is not unit-testable (huge module,
// heavy setup), so this asserts the call sites at the source level — the same
// technique the registration-parity test uses for index.ts. Delete either call
// and publication becomes dead code with no other failing test.
describe('monitor lifecycle call sites', () => {
  const monitorSource = fs.readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      './monitor/index.ts'
    ),
    'utf8'
  );

  it('publishes on boot and again on reconnect', () => {
    expect(monitorSource).toMatch(/publishBotCommandManifestNow\('boot'\)/);
    expect(monitorSource).toMatch(
      /publishBotCommandManifestNow\('reconnect'\)/
    );
  });

  it('builds the manifest inside the failure guard', () => {
    const body = monitorSource.slice(
      monitorSource.indexOf('async function publishBotCommandManifestNow')
    );
    const end = body.indexOf('\n  }\n');
    expect(end).toBeGreaterThan(0);
    const fn = body.slice(0, end);

    // The builder throws when the registry serializes past the byte cap, and
    // boot awaits this call: outside the guard, an oversized registry would
    // take the bot offline instead of just going unadvertised.
    expect(fn).toMatch(/catch/);
    expect(fn.indexOf('try {')).toBeGreaterThan(-1);
    expect(fn.indexOf('try {')).toBeLessThan(
      fn.indexOf('buildCommandManifestJson(')
    );
  });
});
