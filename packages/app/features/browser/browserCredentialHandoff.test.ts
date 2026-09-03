import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginBrowserCredentialHandoff,
  submitBrowserCredentials,
} from './browserCredentialHandoff';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browser credential handoff', () => {
  it('exchanges a trusted viewer capability without returning form values', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            handoffId: 'a'.repeat(43),
            origin: 'https://www.are.na',
            kind: 'password',
            hasUsername: true,
            expiresAt: Date.now() + 60_000,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, submitted: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', request);

    const handoff = await beginBrowserCredentialHandoff(
      'https://browser-session-ovh1.tlon.network/s/payload.signature?clipboardBridge=true'
    );
    expect(handoff.origin).toBe('https://www.are.na');
    expect(request.mock.calls[0][0].toString()).toBe(
      'https://browser-session-ovh1.tlon.network/credentials/payload.signature'
    );

    await expect(
      submitBrowserCredentials(handoff, {
        username: 'person@example.com',
        password: 'not-in-chat',
        submit: true,
      })
    ).resolves.toEqual({ submitted: true });
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
      username: 'person@example.com',
      password: 'not-in-chat',
      submit: true,
    });
  });

  it('rejects an agent-supplied endpoint outside the viewer allowlist', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(
      beginBrowserCredentialHandoff(
        'https://attacker.example/s/payload.signature'
      )
    ).rejects.toThrow('not from a trusted Tlon host');
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    'http://localhost:3000/s/payload.signature',
    'http://127.0.0.1:3000/s/payload.signature',
  ])('rejects a loopback viewer URL: %s', async (viewerUrl) => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(beginBrowserCredentialHandoff(viewerUrl)).rejects.toThrow(
      'not from a trusted Tlon host'
    );
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    'https://browser-session-us-east5-cluster1.tlon.network/s/payload.signature',
    'https://browser-session-ovh-test-1.test.tlon.systems/s/payload.signature',
  ])('accepts a cluster-specific viewer host: %s', async (viewerUrl) => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          handoffId: 'a'.repeat(43),
          origin: 'https://example.com',
          kind: 'password',
          hasUsername: true,
          expiresAt: Date.now() + 60_000,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', request);

    await expect(
      beginBrowserCredentialHandoff(viewerUrl)
    ).resolves.toMatchObject({ origin: 'https://example.com' });
  });

  it('rejects a nested subdomain below a trusted viewer suffix', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(
      beginBrowserCredentialHandoff(
        'https://browser-session-ovh1.attacker.tlon.network/s/payload.signature'
      )
    ).rejects.toThrow('not from a trusted Tlon host');
    expect(request).not.toHaveBeenCalled();
  });

  it('submits a one-time code without exposing password fields', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            handoffId: 'b'.repeat(43),
            origin: 'https://accounts.example',
            kind: 'otp',
            codeLength: 6,
            expiresAt: Date.now() + 60_000,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, submitted: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', request);

    const handoff = await beginBrowserCredentialHandoff(
      'https://browser-session-ovh1.tlon.network/s/payload.signature'
    );
    expect(handoff).toMatchObject({ kind: 'otp', codeLength: 6 });

    await submitBrowserCredentials(handoff, {
      code: '123456',
      submit: true,
    });
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
      code: '123456',
      submit: true,
    });
  });

  it('reports when the browser filled a form without submitting it', async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, submitted: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', request);

    await expect(
      submitBrowserCredentials(
        {
          fillUrl:
            'https://browser-session-ovh1.tlon.network/credential-fills/handoff',
          origin: 'https://example.com',
          expiresAt: Date.now() + 60_000,
          kind: 'password',
          hasUsername: true,
        },
        {
          username: 'person@example.com',
          password: 'keep-in-form',
          submit: true,
        }
      )
    ).resolves.toEqual({ submitted: false });
  });
});
