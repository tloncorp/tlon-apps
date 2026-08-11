import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  BOT_COMMANDS_PUBLISH_ATTEMPTS,
  BOT_COMMANDS_PUBLISH_BACKOFF_MS,
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

// A transient poke failure must not leave a healthy long-lived bot
// unadvertised until an unrelated reconnect or a restart.
describe('publish retry', () => {
  // Injected so the backoff never actually delays the suite.
  const recordingSleeper = () => {
    const slept: number[] = [];
    return {
      slept,
      sleep: async (ms: number) => {
        slept.push(ms);
      },
    };
  };

  const flakyPoke = (failures: number) => {
    let calls = 0;
    return vi.fn(async () => {
      calls += 1;
      if (calls <= failures) {
        throw new Error(`poke nacked ${calls}`);
      }
    });
  };

  it('retries a failing poke and succeeds on the third attempt', async () => {
    const poke = flakyPoke(2);
    const { slept, sleep } = recordingSleeper();

    await expect(
      maybePublishBotCommandManifest({ poke }, read({}), manifestValue, sleep)
    ).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(BOT_COMMANDS_PUBLISH_ATTEMPTS);
    expect(slept).toEqual([...BOT_COMMANDS_PUBLISH_BACKOFF_MS]);
  });

  it('awaits each backoff before the next attempt', async () => {
    // A recording sleeper cannot tell an awaited sleep from a dropped one: if
    // the publisher forgot `await`, retries would fire immediately and the
    // 2s/8s timers would escape the publish call. Deferred sleepers pin the
    // ordering — the next poke must not happen until the delay is released.
    const poke = flakyPoke(2);
    const releases: Array<() => void> = [];
    const sleep = vi.fn(
      (_ms: number) =>
        new Promise<void>((resolve) => {
          releases.push(resolve);
        })
    );
    const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

    const result = maybePublishBotCommandManifest(
      { poke },
      read({}),
      manifestValue,
      sleep
    );

    await flush();
    expect(poke).toHaveBeenCalledTimes(1);
    expect(releases).toHaveLength(1);

    releases[0]();
    await flush();
    expect(poke).toHaveBeenCalledTimes(2);
    expect(releases).toHaveLength(2);

    releases[1]();
    await expect(result).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(3);
    // No sleep is requested after the attempt that succeeds.
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after the attempt cap, non-fatally', async () => {
    const poke = flakyPoke(Number.POSITIVE_INFINITY);
    const { slept, sleep } = recordingSleeper();

    await expect(
      syncBotCommandManifest(
        { poke, scry: vi.fn(async () => ({})) },
        manifestValue,
        undefined,
        sleep
      )
    ).resolves.toBe('skipped');
    expect(poke).toHaveBeenCalledTimes(BOT_COMMANDS_PUBLISH_ATTEMPTS);
    // Backoff only *between* attempts, never after the last one.
    expect(slept).toHaveLength(BOT_COMMANDS_PUBLISH_ATTEMPTS - 1);
  });

  it('does not retry when the read failed', async () => {
    const poke = flakyPoke(Number.POSITIVE_INFINITY);
    const { slept, sleep } = recordingSleeper();

    await expect(
      maybePublishBotCommandManifest(
        { poke },
        { ok: false, error: new Error('scry failed') },
        manifestValue,
        sleep
      )
    ).resolves.toBe('skipped');
    expect(poke).not.toHaveBeenCalled();
    expect(slept).toEqual([]);
  });

  it('does not retry when the compare says unchanged', async () => {
    const poke = flakyPoke(Number.POSITIVE_INFINITY);
    const { slept, sleep } = recordingSleeper();

    await expect(
      maybePublishBotCommandManifest(
        { poke },
        read(selfContactWith({ type: 'text', value: manifestValue })),
        manifestValue,
        sleep
      )
    ).resolves.toBe('unchanged');
    expect(poke).not.toHaveBeenCalled();
    expect(slept).toEqual([]);
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

    // Sleeper injected so the publish retry's backoff does not delay the suite.
    await expect(
      syncBotCommandManifest(api, manifestValue, undefined, async () => {})
    ).resolves.toBe('skipped');
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
