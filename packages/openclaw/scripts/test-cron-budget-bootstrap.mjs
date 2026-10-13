import {
  mkdtemp,
  cp,
  mkdir,
  rm,
  symlink,
  writeFile as writeFixture,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync as runNode } from 'node:child_process';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const sdkRoot =
  process.env.OPENCLAW_TEST_PACKAGE ??
  dirname(
    dirname(
      dirname(
        fileURLToPath(import.meta.resolve('openclaw/plugin-sdk/config-runtime'))
      )
    )
  );
const temporary = await mkdtemp(join(tmpdir(), 'tlon-budget-bootstrap-'));
try {
  await mkdir(join(temporary, 'node_modules'));
  await mkdir(join(temporary, 'state'));
  await symlink(sdkRoot, join(temporary, 'node_modules/openclaw'));
  for (const file of ['cron-budget-bootstrap.js', 'cron-budget-hold.js']) {
    await cp(join(packageRoot, 'dist/src', file), join(temporary, file));
  }
  await writeFixture(join(temporary, 'package.json'), '{"type":"module"}');
  await cp(
    join(packageRoot, 'scripts/fixtures/cron-budget-bootstrap.mjs'),
    join(temporary, 'fixture.mjs')
  );
  runNode(process.execPath, [join(temporary, 'fixture.mjs')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      OPENCLAW_STATE_DIR: join(temporary, 'state'),
      OPENCLAW_CONFIG_PATH: join(temporary, 'state/config.json'),
      TLON_CRON_BUDGET_FILE: join(temporary, 'budget.json'),
    },
  });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
