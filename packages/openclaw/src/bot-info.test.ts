import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  BOT_INFO_CONTACT_KEY,
  BOT_INFO_MAX_BYTES,
  BOT_INFO_PUBLISH_ATTEMPTS,
  BOT_INFO_PUBLISH_BACKOFF_MS,
  type BotInfoPokeApi,
  SELF_CONTACT_SCRY_PATH,
  type SelfContactRead,
  buildBotInfoJson,
  maybePublishBotInfo,
  publishBotInfo,
  readBotInfoValue,
  readSelfContact,
  syncBotInfo,
} from './bot-info.js';
import { defaultSleep } from './sleep.js';

const infoValue = buildBotInfoJson({
  version: '0.19.0',
  harnessVersion: '2026.7.1',
});

describe('buildBotInfoJson', () => {
  it('names the harness, the plugin version, and the host version', () => {
    expect(JSON.parse(infoValue)).toEqual({
      v: 1,
      harness: 'openclaw',
      version: '0.19.0',
      harnessVersion: '2026.7.1',
    });
  });

  it('is byte-stable, so compare-then-poke does not false-positive', () => {
    expect(
      buildBotInfoJson({ version: '0.19.0', harnessVersion: '2026.7.1' })
    ).toBe(infoValue);
  });

  it('omits an unavailable host version rather than invalidating the claim', () => {
    for (const harnessVersion of [undefined, null, '', '   ']) {
      const value = buildBotInfoJson({ version: '0.19.0', harnessVersion });
      expect(JSON.parse(value)).toEqual({
        v: 1,
        harness: 'openclaw',
        version: '0.19.0',
      });
    }
  });

  it('throws rather than publishing past the client parse ceiling', () => {
    expect(() =>
      buildBotInfoJson({ version: 'x'.repeat(BOT_INFO_MAX_BYTES) })
    ).toThrow(/exceeds/);
  });
});

const selfContactWith = (value: unknown) => ({
  nickname: { type: 'text', value: 'Bot' },
  [BOT_INFO_CONTACT_KEY]: value,
});

// A successful read of the given contact map.
const read = (contact: unknown): SelfContactRead => ({ ok: true, contact });

describe('readBotInfoValue', () => {
  it('reads a well-formed text field', () => {
    expect(
      readBotInfoValue(selfContactWith({ type: 'text', value: infoValue }))
    ).toBe(infoValue);
  });

  it('returns null for absent or wrong-shaped fields', () => {
    expect(
      readBotInfoValue({ nickname: { type: 'text', value: 'Bot' } })
    ).toBeNull();
    expect(
      readBotInfoValue(selfContactWith({ type: 'set', value: [] }))
    ).toBeNull();
    expect(
      readBotInfoValue(selfContactWith({ type: 'text', value: 42 }))
    ).toBeNull();
    expect(readBotInfoValue(selfContactWith(infoValue))).toBeNull();
    expect(readBotInfoValue(null)).toBeNull();
    expect(readBotInfoValue('not-a-contact')).toBeNull();
  });
});

describe('publishBotInfo', () => {
  it('pokes the claim as a contact-action-1 self text field', async () => {
    const poke = vi.fn(async () => {});
    const api: BotInfoPokeApi = { poke };

    await expect(publishBotInfo(api, infoValue)).resolves.toBe('published');
    expect(poke).toHaveBeenCalledWith({
      app: 'contacts',
      mark: 'contact-action-1',
      json: {
        self: {
          [BOT_INFO_CONTACT_KEY]: { type: 'text', value: infoValue },
        },
      },
    });
  });

  it('pokes null to clear the key (rollback/retirement)', async () => {
    const poke = vi.fn(async () => {});
    const api: BotInfoPokeApi = { poke };

    await expect(publishBotInfo(api, null)).resolves.toBe('cleared');
    expect(poke).toHaveBeenCalledWith({
      app: 'contacts',
      mark: 'contact-action-1',
      json: { self: { [BOT_INFO_CONTACT_KEY]: null } },
    });
  });
});

describe('maybePublishBotInfo', () => {
  it('publishes when the current value differs', async () => {
    const poke = vi.fn(async () => {});
    const api: BotInfoPokeApi = { poke };

    await expect(
      maybePublishBotInfo(
        api,
        read(
          selfContactWith({
            type: 'text',
            value: '{"v":1,"harness":"openclaw","version":"0.18.0"}',
          })
        ),
        infoValue
      )
    ).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('publishes when nothing is currently published', async () => {
    const poke = vi.fn(async () => {});
    const api: BotInfoPokeApi = { poke };

    await expect(
      maybePublishBotInfo(
        api,
        read({ nickname: { type: 'text', value: 'Bot' } }),
        infoValue
      )
    ).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('skips the poke when the value already matches', async () => {
    const poke = vi.fn(async () => {});
    const api: BotInfoPokeApi = { poke };

    await expect(
      maybePublishBotInfo(
        api,
        read(selfContactWith({ type: 'text', value: infoValue })),
        infoValue
      )
    ).resolves.toBe('unchanged');
    expect(poke).not.toHaveBeenCalled();
  });

  it('republishes over a wrong-shaped stored value', async () => {
    const poke = vi.fn(async () => {});
    const api: BotInfoPokeApi = { poke };

    await expect(
      maybePublishBotInfo(
        api,
        read(selfContactWith({ type: 'numb', value: '0x1' })),
        infoValue
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
      maybePublishBotInfo({ poke }, read({}), infoValue, sleep)
    ).resolves.toBe('published');
    expect(poke).toHaveBeenCalledTimes(BOT_INFO_PUBLISH_ATTEMPTS);
    expect(slept).toEqual([...BOT_INFO_PUBLISH_BACKOFF_MS]);
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

    const result = maybePublishBotInfo({ poke }, read({}), infoValue, sleep);

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
      syncBotInfo(
        { poke, scry: vi.fn(async () => ({})) },
        infoValue,
        undefined,
        sleep
      )
    ).resolves.toBe('skipped');
    expect(poke).toHaveBeenCalledTimes(BOT_INFO_PUBLISH_ATTEMPTS);
    // Backoff only *between* attempts, never after the last one.
    expect(slept).toHaveLength(BOT_INFO_PUBLISH_ATTEMPTS - 1);
  });

  it('stops retrying when aborted during the backoff', async () => {
    // Shutdown/config-reload during the 2s/8s window: the retired monitor must
    // not keep the retry loop alive against its stale SSE client. The abortable
    // default sleeper rejects on abort; the rejection surfaces through
    // syncBotInfo's catch as a non-fatal 'skipped'.
    const poke = flakyPoke(Number.POSITIVE_INFINITY);
    const controller = new AbortController();
    // Honors the signal the way defaultSleep does, without real timers.
    const sleep = vi.fn(
      (_ms: number, signal?: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new Error('Aborted')),
            { once: true }
          );
        })
    );

    const result = syncBotInfo(
      { poke, scry: vi.fn(async () => ({})) },
      infoValue,
      undefined,
      sleep,
      controller.signal
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(poke).toHaveBeenCalledTimes(1);

    controller.abort();
    await expect(result).resolves.toBe('skipped');
    // The abort ended the loop: no further pokes were attempted.
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending default-sleeper timer on abort', async () => {
    const controller = new AbortController();
    const poke = flakyPoke(Number.POSITIVE_INFINITY);

    // Default sleeper + a 2s backoff: without abort handling this test would
    // time out; with it, the abort rejects promptly and the timer is cleared.
    const pending = publishBotInfo(
      { poke },
      infoValue,
      undefined,
      controller.signal
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();

    await expect(pending).rejects.toThrow('Aborted');
    expect(poke).toHaveBeenCalledTimes(1);
  });

  // Cleanup proofs for the sleeper itself: rejecting promptly is not enough —
  // a cleared rejection with a leaked timer keeps the retired monitor's event
  // loop alive for the full backoff anyway, and a leaked abort listener
  // accumulates across publishes on a long-lived signal.
  describe('defaultSleep cleanup', () => {
    it('clears the pending timer the moment the signal aborts', async () => {
      vi.useFakeTimers();
      try {
        const controller = new AbortController();
        const pending = defaultSleep(2_000, controller.signal);
        expect(vi.getTimerCount()).toBe(1);

        controller.abort();
        expect(vi.getTimerCount()).toBe(0);
        await expect(pending).rejects.toThrow('Aborted');
      } finally {
        vi.useRealTimers();
      }
    });

    it('allocates no timer for an already-aborted signal', async () => {
      vi.useFakeTimers();
      try {
        const controller = new AbortController();
        controller.abort();
        const pending = defaultSleep(2_000, controller.signal);
        expect(vi.getTimerCount()).toBe(0);
        await expect(pending).rejects.toThrow('Aborted');
      } finally {
        vi.useRealTimers();
      }
    });

    it('removes its abort listener when the timer wins', async () => {
      vi.useFakeTimers();
      try {
        const controller = new AbortController();
        const removed = vi.spyOn(controller.signal, 'removeEventListener');
        const pending = defaultSleep(2_000, controller.signal);

        vi.advanceTimersByTime(2_000);
        await expect(pending).resolves.toBeUndefined();
        expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));

        // A later abort is a no-op: the promise already settled and no
        // listener remains to fire (an unhandled rejection here would fail
        // the run).
        controller.abort();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('does not retry when the read failed', async () => {
    const poke = flakyPoke(Number.POSITIVE_INFINITY);
    const { slept, sleep } = recordingSleeper();

    await expect(
      maybePublishBotInfo(
        { poke },
        { ok: false, error: new Error('scry failed') },
        infoValue,
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
      maybePublishBotInfo(
        { poke },
        read(selfContactWith({ type: 'text', value: infoValue })),
        infoValue,
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
    const api: BotInfoPokeApi = { poke };

    await expect(
      maybePublishBotInfo(
        api,
        { ok: false, error: new Error('scry failed') },
        infoValue
      )
    ).resolves.toBe('skipped');
    expect(poke).not.toHaveBeenCalled();
  });

  it('publishes when the read succeeded with an empty contact map', async () => {
    const poke = vi.fn(async () => {});
    const api: BotInfoPokeApi = { poke };

    await expect(maybePublishBotInfo(api, read({}), infoValue)).resolves.toBe(
      'published'
    );
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
describe('syncBotInfo', () => {
  const makeApi = (scryImpl: () => Promise<unknown>) => {
    const poke = vi.fn(async () => {});
    const scry = vi.fn(scryImpl);
    return { api: { poke, scry }, poke, scry };
  };

  it('re-reads the self-contact and publishes when it differs', async () => {
    const { api, poke, scry } = makeApi(async () => ({}));

    await expect(syncBotInfo(api, infoValue)).resolves.toBe('published');
    expect(scry).toHaveBeenCalledWith(SELF_CONTACT_SCRY_PATH);
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('re-reads and skips the poke when the value already matches', async () => {
    const { api, poke } = makeApi(async () =>
      selfContactWith({ type: 'text', value: infoValue })
    );

    await expect(syncBotInfo(api, infoValue)).resolves.toBe('unchanged');
    expect(poke).not.toHaveBeenCalled();
  });

  it('skips (never throws) when the re-read fails', async () => {
    const { api, poke } = makeApi(async () => {
      throw new Error('ship unreachable');
    });

    await expect(syncBotInfo(api, infoValue)).resolves.toBe('skipped');
    expect(poke).not.toHaveBeenCalled();
  });

  it('reuses a supplied read instead of scrying again (boot path)', async () => {
    const { api, poke, scry } = makeApi(async () => ({}));

    await expect(syncBotInfo(api, infoValue, read({}))).resolves.toBe(
      'published'
    );
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
      syncBotInfo(api, infoValue, undefined, async () => {})
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
    expect(monitorSource).toMatch(/publishBotInfoNow\('boot'\)/);
    expect(monitorSource).toMatch(/publishBotInfoNow\('reconnect'\)/);
  });

  it('builds the claim inside the failure guard', () => {
    const body = monitorSource.slice(
      monitorSource.indexOf('async function publishBotInfoNow')
    );
    const end = body.indexOf('\n  }\n');
    expect(end).toBeGreaterThan(0);
    const fn = body.slice(0, end);

    // The builder throws when the claim serializes past the byte cap, and boot
    // awaits this call: outside the guard, an oversized value would take the
    // bot offline instead of just leaving it unidentified.
    expect(fn).toMatch(/catch/);
    expect(fn.indexOf('try {')).toBeGreaterThan(-1);
    expect(fn.indexOf('try {')).toBeLessThan(fn.indexOf('buildBotInfoJson('));
  });

  it('sources both versions from the plugin identity and the host', () => {
    // buildBotInfoJson is pure, so only the call site can bind the claim to the
    // real versions; hardcoding or dropping either would pass every other test.
    const body = monitorSource.slice(
      monitorSource.indexOf('async function publishBotInfoNow')
    );
    const fn = body.slice(0, body.indexOf('\n  }\n'));
    expect(fn).toMatch(/version: getTlonVersionIdentity\(\)\.pluginVersion/);
    expect(fn).toMatch(/harnessVersion: core\.version/);
  });

  it('forwards the monitor abort signal into the publish call', () => {
    // The abort-loop unit test injects a signal directly, so it cannot catch
    // the monitor forgetting to pass its own: dropping opts.abortSignal from
    // this call would revive the retired-monitor backoff zombie with every
    // other test green.
    const body = monitorSource.slice(
      monitorSource.indexOf('async function publishBotInfoNow')
    );
    const fn = body.slice(0, body.indexOf('\n  }\n'));
    expect(fn).toMatch(/syncBotInfo\([\s\S]*?opts\.abortSignal/);
  });
});
