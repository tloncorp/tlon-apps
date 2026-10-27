import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type BrowserCredentialHandoff,
  beginBrowserCredentialHandoff,
  cancelBrowserCredentialHandoff,
  submitBrowserCredentials,
  trustedBrowserViewerUrl,
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
  it('distinguishes an ended request from a missing live form without echoing server text', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response(
            { code: 'handoff_complete', error: 'private server detail' },
            404
          )
        )
    );
    await expect(beginBrowserCredentialHandoff(viewer)).rejects.toMatchObject({
      status: 404,
      code: 'handoff_complete',
      message:
        'This secure-entry request has ended. Ask your bot for a new form.',
    });
  });
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
  it('retries a failed cancellation once and rejects an unacknowledged cancellation', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal('fetch', request);
    await cancelBrowserCredentialHandoff(viewer);
    expect(request).toHaveBeenCalledTimes(2);
    request.mockClear().mockResolvedValue(response({}, 500));
    await expect(cancelBrowserCredentialHandoff(viewer)).rejects.toThrow(
      'could not be canceled'
    );
    expect(request).toHaveBeenCalledTimes(2);
    request.mockClear().mockResolvedValue(response({}, 401));
    await expect(cancelBrowserCredentialHandoff(viewer)).rejects.toThrow(
      'could not be canceled'
    );
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
      submit: false,
    });
    expect(request.mock.calls[1][1]).toMatchObject({
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
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
      submit: false,
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
        submit: false,
      })
    ).resolves.toEqual({ submitted: false });
    expect(JSON.parse(request.mock.calls[0][1].body).submit).toBe(false);
    await expect(
      submitBrowserCredentials(target, { values: { f0: '4111111111111111' } })
    ).rejects.toThrow('Reconnect before trying again');
  });
});

describe('local viewer development opt-in', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it('allows only the configured loopback origin in a development build', () => {
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv(
      'EXPO_PUBLIC_BROWSER_VIEWER_DEV_ORIGIN',
      'http://127.0.0.1:8905'
    );
    expect(
      trustedBrowserViewerUrl('http://127.0.0.1:8905/s/demo.signature')
    ).toBe('http://127.0.0.1:8905/s/demo.signature');
    expect(() =>
      trustedBrowserViewerUrl('http://127.0.0.1:8906/s/demo.signature')
    ).toThrow();
    expect(() =>
      trustedBrowserViewerUrl('http://example.com/s/demo.signature')
    ).toThrow();
  });
  it('rejects the loopback exception in release builds or without opt-in', () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubEnv(
      'EXPO_PUBLIC_BROWSER_VIEWER_DEV_ORIGIN',
      'http://127.0.0.1:8905'
    );
    expect(() =>
      trustedBrowserViewerUrl('http://127.0.0.1:8905/s/demo.signature')
    ).toThrow();
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv('EXPO_PUBLIC_BROWSER_VIEWER_DEV_ORIGIN', '');
    expect(() =>
      trustedBrowserViewerUrl('http://127.0.0.1:8905/s/demo.signature')
    ).toThrow();
  });
});

describe('explicit web viewer development origin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it.each([
    'http://127.0.0.1:43841',
    'http://192.168.1.25:43841',
    'http://viewer.local:43841',
  ])(
    'accepts exactly the configured origin in an opted-in web bundle: %s',
    (origin) => {
      vi.stubGlobal('__DEV__', false);
      vi.stubEnv('TLON_BROWSER_VIEWER_DEV_ORIGIN', origin);
      expect(trustedBrowserViewerUrl(`${origin}/s/demo.signature`)).toBe(
        `${origin}/s/demo.signature`
      );
      expect(() =>
        trustedBrowserViewerUrl(
          `${origin.replace('43841', '43842')}/s/demo.signature`
        )
      ).toThrow();
      expect(() =>
        trustedBrowserViewerUrl(`${origin}/other/demo.signature`)
      ).toThrow();
      expect(() =>
        trustedBrowserViewerUrl(
          `${origin.replace('http://', 'http://user@')}/s/demo.signature`
        )
      ).toThrow();
      vi.stubEnv('TLON_BROWSER_VIEWER_DEV_ORIGIN', '');
      expect(() =>
        trustedBrowserViewerUrl(`${origin}/s/demo.signature`)
      ).toThrow();
    }
  );
});
