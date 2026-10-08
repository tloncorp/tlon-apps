import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import { LOCALHOST_TLS } from '../fixtures/localhost-tls';

// The upload PUT runs here from a standalone binary (`bun build --compile`)
// against a real TLS server, because that is the only shape in which its
// failure mode appears: a file body the shipped tlon binary sent fine and
// then crashed on, after storage had the bytes, while `bun run` of the same
// source and the unit tests' stubbed fetch both passed. See
// scripts/buckets-upload-transport.ts for the mechanism.

const rootDir = resolve(process.cwd());
const PROBE_SOURCE = join(
  rootDir,
  'tests',
  'fixtures',
  'buckets-upload-probe.ts'
);
const COMPILE_TIMEOUT_MS = 90_000;
const PROBE_TIMEOUT_MS = 15_000;

// What the Bucket host hands back with a grant: the broker's required
// headers, which the signature covers and the PUT must carry verbatim.
const SIGNED_HEADERS: [string, string][] = [
  ['Content-Type', 'text/html'],
  ['x-goog-content-length-range', '0,1048576'],
];

type SeenRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Uint8Array;
};

let tempRoot: string;
let probePath: string;
let caPath: string;
let server: ReturnType<typeof Bun.serve>;
const seen: SeenRequest[] = [];

beforeAll(async () => {
  // Under dist/ (gitignored, where the real build writes the tlon binary)
  // rather than the OS temp dir: Bun 1.3.4's `build --compile` exited 0 and
  // wrote an empty binary when the outfile was on another volume than the
  // sources.
  const distDir = join(rootDir, 'dist');
  mkdirSync(distDir, { recursive: true });
  tempRoot = mkdtempSync(join(distDir, 'buckets-upload-probe-'));
  caPath = join(tempRoot, 'localhost-ca.pem');
  writeFileSync(caPath, LOCALHOST_TLS.cert);

  probePath = join(tempRoot, 'buckets-upload-probe');
  const build = Bun.spawn(
    [
      process.execPath,
      'build',
      '--compile',
      PROBE_SOURCE,
      '--outfile',
      probePath,
    ],
    { cwd: rootDir, stdout: 'pipe', stderr: 'pipe' }
  );
  const [stderr, exitCode] = await Promise.all([
    new Response(build.stderr).text(),
    build.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `compiling the upload probe failed (${exitCode})\n${stderr}`
    );
  }
  if (statSync(probePath).size === 0) {
    throw new Error(`bun ${Bun.version} compiled an empty upload probe`);
  }

  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    tls: { cert: LOCALHOST_TLS.cert, key: LOCALHOST_TLS.key },
    async fetch(request) {
      const url = new URL(request.url);
      seen.push({
        method: request.method,
        path: url.pathname,
        headers: Object.fromEntries(request.headers),
        body: new Uint8Array(await request.arrayBuffer()),
      });
      if (url.pathname === '/redirect') {
        return Response.redirect(
          `https://localhost:${server.port}/elsewhere`,
          307
        );
      }
      return new Response('', { status: 200 });
    },
  });
}, COMPILE_TIMEOUT_MS);

afterAll(() => {
  server?.stop(true);
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
});

async function runProbe(objectPath: string, filePath: string) {
  const proc = Bun.spawn(
    [
      probePath,
      `https://localhost:${server.port}${objectPath}`,
      filePath,
      JSON.stringify(SIGNED_HEADERS),
    ],
    {
      cwd: tempRoot,
      // The probe fetches exactly what production fetches; the fixture CA is
      // trusted the way an operator would trust a private one.
      env: { PATH: process.env.PATH ?? '', NODE_EXTRA_CA_CERTS: caPath },
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  const timeout = setTimeout(() => proc.kill('SIGKILL'), PROBE_TIMEOUT_MS);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  } finally {
    clearTimeout(timeout);
  }
}

function writeFixtureFile(name: string, size: number) {
  const filePath = join(tempRoot, name);
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) bytes[index] = index % 251;
  writeFileSync(filePath, bytes);
  return { filePath, bytes };
}

describe('Bucket upload transport from a compiled binary', () => {
  // 256 KiB is where Bun's fetch changes how it reads a file body; the
  // sizes straddle it, and the first is the shape of an ordinary page.
  it.each([
    ['a small file', 1_369],
    ['a file just under 256 KiB', 256 * 1024 - 1],
    ['a file over 256 KiB', 1024 * 1024],
  ])(
    'PUTs %s with the signed headers verbatim and a content length',
    async (_label, size) => {
      const { filePath, bytes } = writeFixtureFile(`upload-${size}.html`, size);
      const objectPath = `/object-${size}`;
      const before = seen.length;

      const result = await runProbe(objectPath, filePath);

      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ status: 200 });

      const requests = seen.slice(before);
      expect(requests).toHaveLength(1);
      const [request] = requests;
      expect(request.method).toBe('PUT');
      expect(request.path).toBe(objectPath);
      expect(request.body).toEqual(bytes);
      expect(request.headers['content-type']).toBe('text/html');
      expect(request.headers['x-goog-content-length-range']).toBe('0,1048576');
      expect(request.headers['content-length']).toBe(String(size));
      expect(request.headers['transfer-encoding']).toBeUndefined();
    },
    PROBE_TIMEOUT_MS * 2
  );

  it(
    'refuses a redirect from storage instead of following it',
    async () => {
      const { filePath } = writeFixtureFile('redirected.html', 1_369);
      const before = seen.length;

      const result = await runProbe('/redirect', filePath);

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toHaveProperty('error');
      const requests = seen.slice(before);
      expect(requests.map((request) => request.path)).toEqual(['/redirect']);
    },
    PROBE_TIMEOUT_MS * 2
  );
});
