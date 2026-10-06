import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type BrowserCredentialHandoff,
  beginBrowserCredentialHandoff,
  cancelBrowserCredentialHandoff,
  nextBrowserCredentialHandoff,
  submitBrowserCredentials,
} from './browserCredentialHandoff';

const viewer =
  'https://browser-session-ovh1.tlon.network/s/payload.signature?clipboardBridge=true';
const field = {
  id: 'f0',
  purpose: 'current-password',
  label: 'Password',
  inputType: 'password',
  required: true,
};
function body(extra: Record<string, unknown> = {}) {
  return {
    handoffId: 'a'.repeat(43),
    formId: 'form-1',
    origin: 'https://example.com',
    kind: 'login',
    fields: [field],
    expiresAt: Date.now() + 60_000,
    ...extra,
  };
}
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
function handoff(
  extra: Partial<BrowserCredentialHandoff> = {}
): BrowserCredentialHandoff {
  return {
    fillUrl: 'https://browser-session.tlon.network/credential-fills/one-use',
    formId: 'form-1',
    origin: 'https://example.com',
    expiresAt: Date.now() + 60_000,
    kind: 'login',
    fields: [{ ...field, inputType: 'password' }],
    ...extra,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('secure browser form transport', () => {
  it.each(['one-time-code', 'new-password', 'cc-number'])(
    'ignores advertised saved logins for %s fields',
    async (purpose) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          response(
            body({
              fields: [{ ...field, purpose }],
              vault: {
                available: true,
                planet: 'sampel-palnet',
                moon: 'pinser-botter-sampel-palnet',
              },
            })
          )
        )
      );
      const result = await beginBrowserCredentialHandoff(viewer);
      expect(result.vault).toBeUndefined();
      expect(result.fields[0].purpose).toBe(purpose);
    }
  );
  it('cancels only the signed viewer session without sending values or owner proof', async () => {
    const request = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', request);
    await cancelBrowserCredentialHandoff(viewer);
    expect(String(request.mock.calls[0][0])).toBe(
      'https://browser-session-ovh1.tlon.network/credentials/payload.signature'
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      credentials: 'omit',
      redirect: 'error',
    });
    expect(request.mock.calls[0][1].body).toBeUndefined();
    await expect(
      cancelBrowserCredentialHandoff('https://evil.example/s/payload.signature')
    ).rejects.toThrow('trusted');
    expect(request).toHaveBeenCalledOnce();
  });
  it('exchanges a trusted viewer capability, projects only metadata, and posts values only to its fill endpoint', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          body({
            fields: [
              {
                ...field,
                value: 'must-not-return',
                selector: 'must-not-return',
              },
            ],
          })
        )
      )
      .mockResolvedValueOnce(response({ ok: true, submitted: true }));
    vi.stubGlobal('fetch', request);
    const result = await beginBrowserCredentialHandoff(viewer);
    expect(request.mock.calls[0][0].toString()).toBe(
      'https://browser-session-ovh1.tlon.network/credentials/payload.signature'
    );
    expect(JSON.stringify(result)).not.toContain('must-not-return');
    const controller = new AbortController();
    await expect(
      submitBrowserCredentials(
        result,
        { values: { f0: 'not-in-chat' }, submit: true },
        controller.signal
      )
    ).resolves.toEqual({ submitted: true });
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
      values: { f0: 'not-in-chat' },
      submit: true,
    });
    expect(request.mock.calls[1][1]).toMatchObject({
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  });

  it.each([{}, { ok: false }, { ok: 'true' }])(
    'requires an explicit acknowledgement: %j',
    async (result) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(result)));
      await expect(
        submitBrowserCredentials(handoff(), { values: { f0: 'secret' } })
      ).rejects.toThrow('did not confirm');
    }
  );

  it.each([
    'https://attacker.example/s/payload.signature',
    'http://localhost:3000/s/payload.signature',
    'http://127.0.0.1:3000/s/payload.signature',
    'https://browser-session-ovh1.attacker.tlon.network/s/payload.signature',
  ])('rejects an untrusted viewer: %s', async (url) => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(beginBrowserCredentialHandoff(url)).rejects.toThrow(
      'not from a trusted Tlon host'
    );
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    'https://browser-session-us-east5-cluster1.tlon.network',
    'https://browser-session-ovh-test-1.test.tlon.systems',
    'https://browser-session.tlon.network',
    'https://session-viewer.tlon.network',
    'https://browser-session.test.tlon.systems',
    'https://session-viewer.test.tlon.systems',
  ])('accepts a trusted viewer host: %s', async (host) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body())));
    await expect(
      beginBrowserCredentialHandoff(`${host}/s/payload.signature`)
    ).resolves.toMatchObject({ origin: 'https://example.com' });
  });
  it.each([
    'http://example.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
  ])('requires HTTPS for the target website: %s', async (origin) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response(body({ origin })))
    );
    await expect(beginBrowserCredentialHandoff(viewer)).rejects.toThrow(
      'requires an HTTPS website'
    );
  });
  it.each([
    { fields: [] },
    { fields: [field, field] },
    { fields: [{ ...field, id: '__proto__' }] },
    { fields: [{ ...field, inputType: 'script' }] },
    { fields: [{ ...field, exactLength: 0 }] },
    { fields: [{ ...field, inputType: 'select', options: [] }] },
    { expiresAt: 1 },
    { formId: '' },
  ])('rejects malformed metadata: %j', async (bad) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body(bad))));
    await expect(beginBrowserCredentialHandoff(viewer)).rejects.toThrow();
  });
  it.each([
    { values: {} },
    { values: { f0: 'secret', other: 'private' } },
    { values: { f0: '' } },
  ])(
    'rejects values outside the discovered field contract: %j',
    async (values) => {
      const request = vi.fn();
      vi.stubGlobal('fetch', request);
      await expect(
        submitBrowserCredentials(handoff(), {
          values: values.values as Record<string, string>,
        })
      ).rejects.toThrow('Complete');
      expect(request).not.toHaveBeenCalled();
    }
  );
  it('preserves code casing and validates split-code length', async () => {
    const target = handoff({
      fields: [
        {
          id: 'f0',
          purpose: 'one-time-code',
          label: 'Verification code',
          inputType: 'text',
          required: true,
          exactLength: 6,
        },
      ],
    });
    const request = vi
      .fn()
      .mockResolvedValue(response({ ok: true, submitted: true }));
    vi.stubGlobal('fetch', request);
    await expect(
      submitBrowserCredentials(target, { values: { f0: '123' } })
    ).rejects.toThrow('Complete');
    await submitBrowserCredentials(target, {
      values: { f0: 'aBc123' },
      submit: true,
    });
    expect(JSON.parse(request.mock.calls[0][1].body).values.f0).toBe('aBc123');
  });
  it('forces fill-only for card/address fields and does not echo upstream errors', async () => {
    const target = handoff({
      kind: 'details',
      fields: [
        {
          id: 'f0',
          purpose: 'cc-number',
          label: 'Card number',
          inputType: 'numeric',
          required: true,
        },
      ],
    });
    const request = vi
      .fn()
      .mockResolvedValueOnce(response({ ok: true, submitted: false }))
      .mockResolvedValueOnce(response({ error: 'echoed-private-value' }, 500));
    vi.stubGlobal('fetch', request);
    await expect(
      submitBrowserCredentials(target, {
        values: { f0: '4111111111111111' },
        submit: true,
      })
    ).resolves.toEqual({ submitted: false });
    expect(JSON.parse(request.mock.calls[0][1].body).submit).toBe(false);
    await expect(
      submitBrowserCredentials(target, { values: { f0: '4111111111111111' } })
    ).rejects.toThrow('Reconnect before trying again');
  });
});

describe('next secure step', () => {
  it('waits through navigation, then returns a changed form without submitting it', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockResolvedValueOnce(response({}, 404))
      .mockResolvedValueOnce(
        response(body({ formId: 'next', origin: 'https://identity.example' }))
      );
    vi.stubGlobal('fetch', request);
    const pending = nextBrowserCredentialHandoff(
      viewer,
      'form-1',
      new AbortController().signal
    );
    await vi.advanceTimersByTimeAsync(600);
    await expect(pending).resolves.toMatchObject({
      formId: 'next',
      origin: 'https://identity.example',
    });
    expect(request.mock.calls.every((call) => call[1].method === 'GET')).toBe(
      true
    );
  });
  it.each(['same', 'missing'])(
    'waits for settling and returns %s without assuming authentication',
    async (state) => {
      vi.useFakeTimers();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(async () =>
            state === 'same' ? response(body()) : response({}, 404)
          )
      );
      const pending = nextBrowserCredentialHandoff(
        viewer,
        'form-1',
        new AbortController().signal
      );
      await vi.advanceTimersByTimeAsync(5100);
      if (state === 'same')
        await expect(pending).resolves.toMatchObject({ formId: 'form-1' });
      else await expect(pending).resolves.toBeNull();
    }
  );
  it('aborts polling immediately and never turns a network failure into completion', async () => {
    vi.useFakeTimers();
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const controller = new AbortController();
    const pending = nextBrowserCredentialHandoff(
      viewer,
      'form-1',
      controller.signal
    );
    const rejected = expect(pending).rejects.toBeDefined();
    controller.abort();
    await rejected;
    expect(request).not.toHaveBeenCalled();
    request.mockRejectedValue(new Error('Network unavailable'));
    const failure = nextBrowserCredentialHandoff(
      viewer,
      'form-1',
      new AbortController().signal
    );
    const failed = expect(failure).rejects.toThrow('Network unavailable');
    await vi.advanceTimersByTimeAsync(300);
    await failed;
  });
});
