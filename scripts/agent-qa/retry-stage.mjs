// Retry infrastructure failures on the same worker; review checkpoints skip completed stages.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const name = process.argv[2];
if (!['review-recording.mjs', 'present-run.mjs'].includes(name))
  throw new Error('Unknown resumable stage');
for (let attempt = 1; attempt <= 2; attempt++) {
  const result = spawnSync(
    process.execPath,
    [path.join(path.dirname(fileURLToPath(import.meta.url)), name)],
    {
      stdio: 'inherit',
      env: process.env,
      timeout: 25 * 60000,
    }
  );
  if (result.status === 0) {
    const report = path.resolve(
      '../../artifacts/qa-presentation/original-report.json'
    );
    if (existsSync(report))
      writeFileSync(
        '/tmp/qa-product-status',
        JSON.parse(readFileSync(report)).report.status
      );
    process.exit(0);
  }
  if (attempt === 1)
    console.log(
      'Resuming the failed review/publish stage; completed checkpoints are retained.'
    );
}
throw new Error('Recorded-evidence stage failed after one checkpointed retry');
