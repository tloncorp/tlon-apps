import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyRuntime(bytes, expected) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected)
    throw new Error('Pinned Urbit runtime checksum mismatch');
  return actual;
}

export async function prepareRuntime(root) {
  if (process.platform !== 'linux' || process.arch !== 'x64')
    throw new Error('Hosted QA runtime is pinned for Linux x64');
  const pin = JSON.parse(
    readFileSync(new URL('./runtime.json', import.meta.url))
  );
  const dir = path.join(root, 'apps/tlon-web/rube/dist/urbit_extracted');
  const binary = path.join(dir, 'urbit');
  if (!existsSync(binary)) {
    mkdirSync(dir, { recursive: true });
    const response = await fetch(pin.url, {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok)
      throw new Error(`Urbit runtime download failed: ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    verifyRuntime(archive, pin.archiveSha256);
    const archivePath = path.join(dir, 'runtime.tgz');
    writeFileSync(archivePath, archive);
    try {
      const bytes = execFileSync('tar', ['-xOf', archivePath, pin.member], {
        maxBuffer: 100 * 1024 * 1024,
      });
      verifyRuntime(bytes, pin.binarySha256);
      writeFileSync(binary, bytes, { mode: 0o755 });
    } finally {
      rmSync(archivePath, { force: true });
    }
  }
  verifyRuntime(readFileSync(binary), pin.binarySha256);
  const receipt = { version: pin.version, binarySha256: pin.binarySha256 };
  writeFileSync(
    path.join(process.env.PROOF_OUTPUT, 'runtime.json'),
    JSON.stringify(receipt)
  );
  console.log(`Verified Urbit ${pin.version}: ${pin.binarySha256}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await prepareRuntime(process.cwd());
