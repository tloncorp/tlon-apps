import { afterAll, describe, expect, it } from 'bun:test';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';

import {
  FETCH_FAILED_ERROR,
  type ResolvedAddress,
  classifyMediaUrl,
  fetchGuardedMedia,
  isAllowedAddress,
  isDeniedHostname,
  strictPostableUrl,
} from './media-guard';

// ---------------------------------------------------------------------------
// Classification (port of OpenClaw's `classifyInput` table, upload.test.ts)
// ---------------------------------------------------------------------------

describe('classifyMediaUrl', () => {
  const localForms = [
    '/pier/foo.png',
    '///pier/foo.png',
    './x.png',
    '../x.png',
    '.\\x.png',
    '..\\x.png',
    '~/x.png',
    'C:\\x.png',
    'C:/x.png',
    'C:foo.png',
    '\\foo.png',
    '\\\\srv\\share\\x.png',
    'file:///pier/foo.png',
    'x:opaque',
  ];

  for (const input of localForms) {
    it(`classifies ${input} as local`, () => {
      expect(classifyMediaUrl(input)).toEqual({ kind: 'local' });
    });
  }

  it('classifies http:// as http', () => {
    expect(classifyMediaUrl('http://host/x.png')).toEqual({ kind: 'http' });
  });

  it('classifies userinfo URLs', () => {
    expect(classifyMediaUrl('https://user:pw@host/x')).toEqual({
      kind: 'userinfo',
    });
    expect(classifyMediaUrl('https://@host/x')).toEqual({ kind: 'userinfo' });
  });

  it('does NOT classify a backslash path as userinfo', () => {
    const result = classifyMediaUrl('https://host\\path@name.png');
    expect(result.kind).toBe('https');
    if (result.kind === 'https') {
      expect(result.canonical).toBe('https://host/path@name.png');
    }
  });

  const invalidForms = [
    'ftp://host/x',
    'data:text/plain,hi',
    'https:foo',
    'https:///foo',
    '//host/path',
    'image.png',
    'dir/image.png',
    'garbage',
  ];

  for (const input of invalidForms) {
    it(`classifies ${input} as invalid`, () => {
      expect(classifyMediaUrl(input)).toEqual({ kind: 'invalid' });
    });
  }

  it('classifies valid https and returns the canonical form', () => {
    expect(classifyMediaUrl('HTTPS://host/x.png')).toEqual({
      kind: 'https',
      canonical: 'https://host/x.png',
    });
  });

  it('trims surrounding whitespace before classifying', () => {
    expect(classifyMediaUrl('  https://host/x.png  ')).toEqual({
      kind: 'https',
      canonical: 'https://host/x.png',
    });
  });

  it('does not normalize a MEDIA: label (CLI argv carries no such label)', () => {
    expect(classifyMediaUrl('MEDIA: https://host/x.png')).toEqual({
      kind: 'invalid',
    });
    expect(classifyMediaUrl('media://host/x.png')).toEqual({ kind: 'invalid' });
  });
});

// ---------------------------------------------------------------------------
// Printed-URL validation (port of OpenClaw's `strictPostableUrl`)
// ---------------------------------------------------------------------------

describe('strictPostableUrl', () => {
  it('accepts a credential-free https URL and returns its canonical form', () => {
    expect(strictPostableUrl('HTTPS://storage.example/a%20b.png')).toBe(
      'https://storage.example/a%20b.png'
    );
  });

  const rejected = [
    ' https://storage.example/x.png',
    'https://storage.example/x.png ',
    'http://storage.example/x.png',
    'https://user:pw@storage.example/x.png',
    'https://@storage.example/x.png',
    'https:///x.png',
    'not a url',
    '/pier/x.png',
  ];

  for (const input of rejected) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      expect(strictPostableUrl(input)).toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// Address / hostname screening
// ---------------------------------------------------------------------------

describe('isDeniedHostname', () => {
  const denied = [
    'localhost',
    'LOCALHOST',
    'localhost.',
    'localhost.localdomain',
    'metadata.google.internal',
    'foo.localhost',
    'printer.local',
    'svc.internal',
    '',
  ];
  for (const host of denied) {
    it(`denies ${JSON.stringify(host)}`, () => {
      expect(isDeniedHostname(host)).toBe(true);
    });
  }

  it('allows ordinary public hostnames', () => {
    expect(isDeniedHostname('storage.example.com')).toBe(false);
    expect(isDeniedHostname('localhostage.example')).toBe(false);
  });
});

describe('isAllowedAddress', () => {
  const blocked = [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.0.2.5',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.4',
    '203.0.113.9',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '64:ff9b::a00:1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    // IPv6 is allow-listed to global unicast (2000::/3) minus carve-outs, so
    // deprecated/special ranges are refused without being individually named:
    'fec0::1', // deprecated site-local fec0::/10
    '::127.0.0.1', // deprecated IPv4-compatible ::/96
    '::10.0.0.1', // deprecated IPv4-compatible ::/96
    '2002:a00:1::1', // 6to4 (embeds 10.0.0.1)
    '2001::1', // Teredo / IETF protocol assignments 2001::/23
    '100::1', // discard-only 100::/64
    '1::1', // outside 2000::/3
    '3fff::1', // documentation 3fff::/20 (RFC 9637)
    '5f00::1', // SRv6 SIDs 5f00::/16 (RFC 9602)
    'not-an-ip',
    '999.1.1.1',
  ];
  for (const address of blocked) {
    it(`blocks ${address}`, () => {
      expect(isAllowedAddress(address)).toBe(false);
    });
  }

  const allowed = ['1.1.1.1', '8.8.8.8', '172.32.0.1', '2606:4700::1111'];
  for (const address of allowed) {
    it(`allows ${address}`, () => {
      expect(isAllowedAddress(address)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Transport: real local servers, only the resolver + address policy injected
// ---------------------------------------------------------------------------

// Self-signed fixture pair for `pinned.invalid`. A fully mocked transport can
// report pinning green without proving the connected peer, so the https branch
// runs against a real TLS server and trusts this CA through the `tlsOptions`
// seam. Production callers never pass `tlsOptions`.
const FIXTURE_CERT = `-----BEGIN CERTIFICATE-----
MIIDMDCCAhigAwIBAgIUZ2vSGpi766PKv7WceC/b7ecnn14wDQYJKoZIhvcNAQEL
BQAwGTEXMBUGA1UEAwwOcGlubmVkLmludmFsaWQwIBcNMjYwODEzMjAyMTM0WhgP
MjEyNjA3MjAyMDIxMzRaMBkxFzAVBgNVBAMMDnBpbm5lZC5pbnZhbGlkMIIBIjAN
BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsEszYyuBPiceT5ysXxP+wMG5Y6H/
Dy0wjhNWo1Yx6VSTAso2WUBemTOsP/Q+kbQJ9d7hYz0WW5FwJg1XuD5zgeR6UuL3
TDVuGpN3Cg+WoMPgb99JBgJN7k2kcUme3wbRQrs2iwz1Itt888UqdmQ42uXl1aVL
xCJirl1UY4GQdgO64oo/YvRJnkcqW9kUqZJRX4N3kLE1M/1JDDVdqkGz0Uwxni/Q
qoSOwBU4gJCFJ3ZeDwtVA2wrPCNGpvtx7GyJTQhhQ2zw15SNAsCkRCC4DG2IP08A
wieCNgGbNj0OJkE438gwVwv1asCzMZtPn1nd0ngHkNZFsjGGLyVHLTklKQIDAQAB
o24wbDAdBgNVHQ4EFgQUkY6Rwqxkxu4ZYezyrFmJV9fIiZUwHwYDVR0jBBgwFoAU
kY6Rwqxkxu4ZYezyrFmJV9fIiZUwDwYDVR0TAQH/BAUwAwEB/zAZBgNVHREEEjAQ
gg5waW5uZWQuaW52YWxpZDANBgkqhkiG9w0BAQsFAAOCAQEAPXJEdTt7hptyHGwu
IX3y10Lx7cVckNljIySV9MHHZS1OZKyJ90iaCS/akwpVE4OUvOzJu+zd5xs+qnmV
X3dL5Nxv/bL3LSqviYERt8ewIjFMcGr/CRT19uxSRW6Zpl1sAxezOYTKtkPJoYPb
xbTzeS4dBq1GlyiIufxC0i4DFJLDTJdUhSapqsdE6MhLjM7ynok2ZvykUq2lDvf/
F3/jeWv8aPo9nk4fMXPwazNIoxLbssxWjsEj3+UAwp2/7v9WTH73gwqPMpOQEnKa
SZtOXqj/OqB7sZ2KYeACyg50Jd4nrIXiET6ksC5Lu21AOSvg77Yq8YxXDoVaxfKq
6fGbzw==
-----END CERTIFICATE-----
`;

const FIXTURE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCwSzNjK4E+Jx5P
nKxfE/7Awbljof8PLTCOE1ajVjHpVJMCyjZZQF6ZM6w/9D6RtAn13uFjPRZbkXAm
DVe4PnOB5HpS4vdMNW4ak3cKD5agw+Bv30kGAk3uTaRxSZ7fBtFCuzaLDPUi23zz
xSp2ZDja5eXVpUvEImKuXVRjgZB2A7riij9i9EmeRypb2RSpklFfg3eQsTUz/UkM
NV2qQbPRTDGeL9CqhI7AFTiAkIUndl4PC1UDbCs8I0am+3HsbIlNCGFDbPDXlI0C
wKREILgMbYg/TwDCJ4I2AZs2PQ4mQTjfyDBXC/VqwLMxm0+fWd3SeAeQ1kWyMYYv
JUctOSUpAgMBAAECggEAHwW0rrxOm23NzyueR4LgvvG4Gli85eJJW476nXaDBPC9
h+2mf7EslF/77SshQYmBgTMtzUVIJGfk6MVLTOAsekyG3AQViWMTk3ikp3ATzQl6
+qS7mGOabBdcmxTd8JgmBcyk7fYjQvWFuO3WqYu8V4TCG4ThXsvAOrewrGv1zFZT
oiTWSApX1Z3wuoozw8a2IfAtZ9pa2JXz4DE9HQOZ5yvba4t+u2t9m/PdUtxJJ4nx
LhewSLvHTQPk9xTAd4vhgLtg3j8X0CoqHnbcFwSdrT2aWoOrZNOsaXgNx6js+YdU
dI7gLh4VXw90YOUtNYy7sq3Pi+NLxLH6NQTpl2NlkwKBgQDoK+kju82ivGoaeu73
tOAOJ3KGV+kQ7GIortF5UJUI88cDQ6T2+M2OJl0KpS1gqK4f42EoxoKbiGfK7ioQ
pCQxZpSbmgM5UaIsuCKcvD28h7q9Fc43+0rBuTIHdVmsOeWOe4D0uQzZIwdNZuhi
l07QoMsKpbnqEW22qgU3j0JLQwKBgQDCYydltWkX+5AX6iwziCXiMuBD5ekOoHKG
4jingrx8RscskaPZtQolEsFfxo1JDzkrx1UDLFFewoA5zhy4K5shVa26rpjacj8W
K0YlUsuU0mWTRpUFGa6bl1DxP01R8+YPavxgH0XKIf3CFXjdRt17/3xNbTexA2hv
JZqgJHaJIwKBgQCwUojg5oQpj0ZVjf9miCuRFExZ0vHiNGPn2bykkZpeDiWaSQlD
t3kE+AW5S/DGc9SpyxnCyd/vFw0chPvVX5NNIUbDVZgVM/YiWEWRGzUXtU0QxTq0
MVh4/5kLKQhNUDsSlqE9OjyTu5KUKg9asObecv9AutQS++GC1GTZ6SbD2QKBgBzT
AyaLzfemb+l76e4CREvUa3jmALcQh6sEpI4CTtzGygYL2pYPyF9S9qWzFYQ946Zg
OnTr/2zjvovTymJs5OX+hHJoLXZG9p/c7tvd+R4qTLGYB8Tn2AJuX6xGTLrYRccH
gEDoojqk67H56SA2v+UBL3dzuIxhCv1gQBt7DLCtAoGBAK3xlZR+k5THr2yIeYRd
9+GJYXY/UChog2dtfK1eNAeee/yrKd0YqlGpUDiG5JraXrBjryvu4OsbIg/xQYpL
yMJunDGQLogR1IuE2oCV2SQ9Nrdh5vbpXijhjjsj5fpebdpF0wAbiacAgE7EjuDM
x/S3QoFfLagWJycN1v5CO322
-----END PRIVATE KEY-----
`;

// The hostname is deliberately unresolvable. A request that completes proves
// the `lookup` override supplied the address and that no real DNS resolution
// happened behind the guard's back.
const PINNED_HOST = 'pinned.invalid';

interface TestServer {
  port: number;
  requests: Array<{ url: string; remoteAddress: string }>;
  connections: number;
  close: () => Promise<void>;
}

const openServers: TestServer[] = [];

async function startServer(
  handler: http.RequestListener,
  tls = false
): Promise<TestServer> {
  const server = tls
    ? https.createServer({ cert: FIXTURE_CERT, key: FIXTURE_KEY }, handler)
    : http.createServer(handler);

  const record: TestServer = {
    port: 0,
    requests: [],
    connections: 0,
    close: () =>
      new Promise<void>((resolve) => {
        (
          server as unknown as { closeAllConnections?: () => void }
        ).closeAllConnections?.();
        server.close(() => resolve());
      }),
  };

  server.on('connection', () => {
    record.connections += 1;
  });
  server.on('request', (req) => {
    record.requests.push({
      url: req.url ?? '',
      remoteAddress: req.socket.remoteAddress ?? '',
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  record.port = (server.address() as AddressInfo).port;
  openServers.push(record);
  return record;
}

afterAll(async () => {
  await Promise.all(openServers.map((server) => server.close()));
});

function countingResolver(address = '127.0.0.1') {
  const calls: string[] = [];
  return {
    calls,
    resolveHost: async (hostname: string): Promise<ResolvedAddress[]> => {
      calls.push(hostname);
      return [{ address, family: 4 }];
    },
  };
}

// Loopback is (correctly) refused by the real policy; the transport tests pin
// to it, so the policy is injected — and still asserted, not bypassed.
const allowLoopback = (address: string): boolean => address === '127.0.0.1';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('fetchGuardedMedia — pinned http transport', () => {
  it('fetches through the pinned resolver without a second resolve', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_BYTES);
    });
    const resolver = countingResolver();

    const result = await fetchGuardedMedia(
      `http://${PINNED_HOST}:${server.port}/image.png`,
      {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: resolver.resolveHost,
        allowAddress: allowLoopback,
      }
    );

    expect(Buffer.from(result.bytes).equals(PNG_BYTES)).toBe(true);
    expect(result.contentType).toBe('image/png');
    expect(result.finalUrl).toBe(
      `http://${PINNED_HOST}:${server.port}/image.png`
    );
    // Exactly one resolve for the single hop, and the peer the server saw is
    // the validated address.
    expect(resolver.calls).toEqual([PINNED_HOST]);
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0].remoteAddress).toBe('127.0.0.1');
  });

  it('re-pins on a same-origin redirect with a fresh connection per hop', async () => {
    const server = await startServer((req, res) => {
      if (req.url === '/start') {
        res.writeHead(302, { location: '/final' });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_BYTES);
    });
    const resolver = countingResolver();

    const result = await fetchGuardedMedia(
      `http://${PINNED_HOST}:${server.port}/start`,
      {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: resolver.resolveHost,
        allowAddress: allowLoopback,
      }
    );

    expect(Buffer.from(result.bytes).equals(PNG_BYTES)).toBe(true);
    expect(result.finalUrl).toBe(`http://${PINNED_HOST}:${server.port}/final`);
    // One resolve per hop — never a second resolve within a hop — and each hop
    // dials its own connection rather than reusing a pooled socket.
    expect(resolver.calls).toEqual([PINNED_HOST, PINNED_HOST]);
    expect(server.connections).toBe(2);
    expect(server.requests.map((entry) => entry.url)).toEqual([
      '/start',
      '/final',
    ]);
    for (const entry of server.requests) {
      expect(entry.remoteAddress).toBe('127.0.0.1');
    }
  });

  it('stops after the redirect cap', async () => {
    let hop = 0;
    const server = await startServer((req, res) => {
      hop += 1;
      res.writeHead(302, { location: `/hop-${hop}` });
      res.end();
    });
    const resolver = countingResolver();

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/start`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        maxRedirects: 3,
        resolveHost: resolver.resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);

    expect(server.requests).toHaveLength(4); // initial + 3 followed redirects
  });

  it('detects a redirect loop', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(302, { location: '/loop' });
      res.end();
    });

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/loop`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
  });

  it('enforces the scheme on every redirect hop', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(302, { location: 'ftp://elsewhere.example/x.png' });
      res.end();
    });

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/start`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    // The redirect target was refused before a second hop was attempted.
    expect(server.requests).toHaveLength(1);
  });

  it('fails on a non-2xx response', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(404);
      res.end('nope');
    });

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/missing.png`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
  });

  it('caps the streamed body without trusting Content-Length', async () => {
    const server = await startServer((req, res) => {
      // No content-length: the cap must come from the streamed byte count.
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.write(Buffer.alloc(64, 1));
      res.end(Buffer.alloc(64, 2));
    });

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/big.bin`, {
        maxBytes: 32,
        deadlineMs: 5_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
  });

  it('enforces the deadline across the body read', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.write(Buffer.from([0x89]));
      // Never finishes the body within the deadline.
    });

    const started = Date.now();
    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/slow.png`, {
        maxBytes: 1024,
        deadlineMs: 300,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('enforces the deadline across DNS resolution', async () => {
    // A resolver slower than the whole budget must surface the fixed error
    // within it — not park the command until an outer process timeout.
    const slowResolver = (): Promise<ResolvedAddress[]> =>
      new Promise((resolve) => {
        setTimeout(() => resolve([{ address: '127.0.0.1', family: 4 }]), 5_000);
      });

    const started = Date.now();
    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:1/never.png`, {
        maxBytes: 1024,
        deadlineMs: 300,
        resolveHost: slowResolver,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('tears down the prior connection when following a redirect', async () => {
    // A server may trail an unbounded body after a redirect head; the hop
    // must destroy that connection rather than let it drain outside the cap
    // and deadline.
    let originSocketClosed = false;
    const destination = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_BYTES);
    });
    const origin = await startServer((req, res) => {
      req.socket.on('close', () => {
        originSocketClosed = true;
      });
      res.writeHead(302, {
        location: `http://${PINNED_HOST}:${destination.port}/image.png`,
        'content-length': '1000000',
      });
      res.write('trailing-'); // starts an endless body, never ends it
    });

    const result = await fetchGuardedMedia(
      `http://${PINNED_HOST}:${origin.port}/start`,
      {
        maxBytes: 1024,
        deadlineMs: 10_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      }
    );
    expect(Buffer.from(result.bytes).equals(PNG_BYTES)).toBe(true);

    // The origin connection must be gone shortly after the redirect was
    // followed, without waiting for the deadline.
    const waitStart = Date.now();
    while (!originSocketClosed && Date.now() - waitStart < 3_000) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(originSocketClosed).toBe(true);
  });
});

describe('fetchGuardedMedia — Content-Encoding is fail-closed', () => {
  it('rejects a gzip-encoded response', async () => {
    // We ask for `Accept-Encoding: identity`; a server that compresses anyway
    // is refused outright rather than decoded, so the byte cap always applies
    // to the bytes actually streamed.
    const server = await startServer((req, res) => {
      res.writeHead(200, {
        'content-type': 'image/png',
        'content-encoding': 'gzip',
      });
      res.end(zlib.gzipSync(PNG_BYTES));
    });

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/gz.png`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
  });

  it('rejects an unknown coding', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'content-encoding': 'exotic' });
      res.end(PNG_BYTES);
    });

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/x.png`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
  });

  it('rejects stacked codings', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'content-encoding': 'gzip, br' });
      res.end(zlib.gzipSync(PNG_BYTES));
    });

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/x.png`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
  });

  it('accepts an explicit identity coding', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'content-encoding': 'identity' });
      res.end(PNG_BYTES);
    });

    const result = await fetchGuardedMedia(
      `http://${PINNED_HOST}:${server.port}/x.png`,
      {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
      }
    );
    expect(Buffer.from(result.bytes).equals(PNG_BYTES)).toBe(true);
  });
});

describe('fetchGuardedMedia — rejections that never open a connection', () => {
  it('refuses a denied hostname before resolving', async () => {
    const resolver = countingResolver();

    await expect(
      fetchGuardedMedia('https://localhost/x.png', {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: resolver.resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    expect(resolver.calls).toEqual([]);
  });

  it('refuses a private resolved address before connecting', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200);
      res.end(PNG_BYTES);
    });
    const resolver = countingResolver('10.0.0.5');

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}:${server.port}/x.png`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: resolver.resolveHost,
        // Real policy, not the loopback override.
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    expect(resolver.calls).toEqual([PINNED_HOST]);
    expect(server.connections).toBe(0);
  });

  it('refuses a plain-http target under requireHttps', async () => {
    const resolver = countingResolver();

    await expect(
      fetchGuardedMedia(`http://${PINNED_HOST}/x.png`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        requireHttps: true,
        resolveHost: resolver.resolveHost,
        allowAddress: allowLoopback,
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    expect(resolver.calls).toEqual([]);
  });
});

// Https hops pin through `node:https`'s `lookup` override, exactly like the
// plain-http hops, with certificate identity verified against the hostname
// (requires Bun >= 1.3.11 — see the module doc in media-guard.ts). These cases
// run against real local TLS servers with only the resolver/address policy
// injected.
describe('fetchGuardedMedia — pinned https transport', () => {
  it('completes a TLS request against the pinned address', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_BYTES);
    }, true);
    const resolver = countingResolver();

    const result = await fetchGuardedMedia(
      `https://${PINNED_HOST}:${server.port}/image.png`,
      {
        maxBytes: 1024,
        deadlineMs: 10_000,
        requireHttps: true,
        resolveHost: resolver.resolveHost,
        allowAddress: allowLoopback,
        tlsOptions: { ca: [FIXTURE_CERT] },
      }
    );

    expect(Buffer.from(result.bytes).equals(PNG_BYTES)).toBe(true);
    expect(resolver.calls).toEqual([PINNED_HOST]);
    expect(server.requests[0].remoteAddress).toBe('127.0.0.1');
  });

  it('rejects a downgrade to http across a redirect under requireHttps', async () => {
    const plain = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_BYTES);
    });
    const secure = await startServer((req, res) => {
      res.writeHead(302, {
        location: `http://${PINNED_HOST}:${plain.port}/image.png`,
      });
      res.end();
    }, true);

    await expect(
      fetchGuardedMedia(`https://${PINNED_HOST}:${secure.port}/start`, {
        maxBytes: 1024,
        deadlineMs: 10_000,
        requireHttps: true,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
        tlsOptions: { ca: [FIXTURE_CERT] },
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    expect(plain.connections).toBe(0);
  });

  it('rejects an untrusted certificate', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200);
      res.end(PNG_BYTES);
    }, true);

    await expect(
      fetchGuardedMedia(`https://${PINNED_HOST}:${server.port}/image.png`, {
        maxBytes: 1024,
        deadlineMs: 10_000,
        requireHttps: true,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
        // No fixture CA: default verification must reject the self-signed cert.
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
  });

  it('rejects a certificate for a different hostname', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200);
      res.end(PNG_BYTES);
    }, true);

    // Trusted CA, pinned address — but the requested hostname does not match
    // the certificate's DNS SAN, so identity verification must abort the hop.
    await expect(
      fetchGuardedMedia(`https://evil.invalid:${server.port}/image.png`, {
        maxBytes: 1024,
        deadlineMs: 10_000,
        requireHttps: true,
        resolveHost: countingResolver().resolveHost,
        allowAddress: allowLoopback,
        tlsOptions: { ca: [FIXTURE_CERT] },
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    expect(server.requests).toHaveLength(0);
  });

  it('decodes a chunked response body', async () => {
    const server = await startServer((req, res) => {
      // No content-length: node/bun emit Transfer-Encoding: chunked.
      res.writeHead(200, { 'content-type': 'image/png' });
      res.write(PNG_BYTES.subarray(0, 4));
      res.write(PNG_BYTES.subarray(4));
      res.end();
    }, true);
    const resolver = countingResolver();

    const result = await fetchGuardedMedia(
      `https://${PINNED_HOST}:${server.port}/chunked.png`,
      {
        maxBytes: 1024,
        deadlineMs: 10_000,
        requireHttps: true,
        resolveHost: resolver.resolveHost,
        allowAddress: allowLoopback,
        tlsOptions: { ca: [FIXTURE_CERT] },
      }
    );

    expect(Buffer.from(result.bytes).equals(PNG_BYTES)).toBe(true);
  });

  it('follows an https redirect with a fresh pinned connection per hop', async () => {
    const destination = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_BYTES);
    }, true);
    const origin = await startServer((req, res) => {
      res.writeHead(302, {
        location: `https://${PINNED_HOST}:${destination.port}/image.png`,
      });
      res.end();
    }, true);
    const resolver = countingResolver();

    const result = await fetchGuardedMedia(
      `https://${PINNED_HOST}:${origin.port}/start`,
      {
        maxBytes: 1024,
        deadlineMs: 10_000,
        requireHttps: true,
        resolveHost: resolver.resolveHost,
        allowAddress: allowLoopback,
        tlsOptions: { ca: [FIXTURE_CERT] },
      }
    );

    expect(Buffer.from(result.bytes).equals(PNG_BYTES)).toBe(true);
    // One resolve per hop; both hops reached the pinned loopback address.
    expect(resolver.calls).toEqual([PINNED_HOST, PINNED_HOST]);
    expect(destination.requests[0].remoteAddress).toBe('127.0.0.1');
  });

  it('screens every resolved address before any dial — failover never reaches an unvetted one', async () => {
    // First address passes policy, second does not. The guard must refuse the
    // whole fetch up front (no connection at all), not dial the first and
    // fail over into the disallowed second.
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_BYTES);
    }, true);

    await expect(
      fetchGuardedMedia(`https://${PINNED_HOST}:${server.port}/mixed.png`, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        requireHttps: true,
        resolveHost: async () => [
          { address: '127.0.0.1', family: 4 },
          { address: '10.0.0.5', family: 4 },
        ],
        allowAddress: allowLoopback, // 10.0.0.5 is refused
        tlsOptions: { ca: [FIXTURE_CERT] },
      })
    ).rejects.toThrow(FETCH_FAILED_ERROR);
    expect(server.connections).toBe(0);
  });

  it('fails over to the next validated address on a connection refusal', async () => {
    // Server listens on 127.0.0.1 only; the resolver hands back ::1 first.
    // The ::1 dial is refused before any response arrives, so the hop must
    // retry the next validated address rather than failing the fetch.
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG_BYTES);
    }, true);

    const resolveHost = async (): Promise<ResolvedAddress[]> => [
      { address: '::1', family: 6 },
      { address: '127.0.0.1', family: 4 },
    ];

    const result = await fetchGuardedMedia(
      `https://${PINNED_HOST}:${server.port}/failover.png`,
      {
        maxBytes: 1024,
        deadlineMs: 10_000,
        requireHttps: true,
        resolveHost,
        allowAddress: (address) => address === '127.0.0.1' || address === '::1',
        tlsOptions: { ca: [FIXTURE_CERT] },
      }
    );

    expect(Buffer.from(result.bytes).equals(PNG_BYTES)).toBe(true);
    expect(server.requests[0].remoteAddress).toBe('127.0.0.1');
  });
});

describe('fetchGuardedMedia — leak safety', () => {
  it('never echoes the URL, host, or resolved address in the error', async () => {
    const resolver = countingResolver('10.0.0.5');
    const secretUrl =
      'https://storage.example.com/private.png?signature=SUPERSECRET';

    let message = '';
    try {
      await fetchGuardedMedia(secretUrl, {
        maxBytes: 1024,
        deadlineMs: 5_000,
        resolveHost: resolver.resolveHost,
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe(FETCH_FAILED_ERROR);
    expect(message).not.toContain('SUPERSECRET');
    expect(message).not.toContain('storage.example.com');
    expect(message).not.toContain('10.0.0.5');
  });
});
