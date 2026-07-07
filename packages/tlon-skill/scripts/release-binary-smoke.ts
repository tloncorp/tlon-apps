import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fail, smokeCliBinary } from './release-utils';

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index !== -1) {
    return process.argv[index + 1];
  }

  return undefined;
}

const rootDir = process.cwd();
const binaryArg = argValue('--binary');
if (!binaryArg) {
  fail('Usage: bun run scripts/release-binary-smoke.ts --binary <path>');
}

const packageJson = JSON.parse(
  readFileSync(resolve(rootDir, 'package.json'), 'utf-8')
) as { version: string };

smokeCliBinary(resolve(rootDir, binaryArg), packageJson.version, rootDir);
console.log(`ok - smoked ${binaryArg}`);
