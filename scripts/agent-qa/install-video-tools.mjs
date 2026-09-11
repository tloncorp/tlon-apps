// Pinned Linux binaries avoid installing unrelated codec dependencies on the publisher.
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw new Error('Expected Linux x64 publisher');
const digests = {
  ffmpeg: 'bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa',
  ffprobe: '25d9b6ccb05e3d9de9e04e31e2506d8dd7f9f0418981965ac6df12e8d3afd067',
};
const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-video-tools-'));
try {
  await Promise.all(
    Object.entries(digests).map(async ([name, digest]) => {
      const r = await fetch(
        `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/${name}-linux-x64.gz`,
        { signal: AbortSignal.timeout(120000) }
      );
      if (!r.ok) throw new Error(`Could not download ${name}`);
      const bytes = Buffer.from(await r.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== digest)
        throw new Error(`Invalid ${name} checksum`);
      const file = path.join(dir, name);
      writeFileSync(file, gunzipSync(bytes));
      execFileSync('sudo', [
        'install',
        '-m',
        '755',
        file,
        `/usr/local/bin/${name}`,
      ]);
    })
  );
  console.log('Installed checksum-verified FFmpeg and FFprobe 6.1.1.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
