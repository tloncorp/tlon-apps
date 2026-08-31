import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_BUNDLE_PORT,
  UPLOAD_KEY_PATTERN,
  startBundleServer,
} from './bundleServer';

/**
 * The dev storage stand-in, on its own.
 *
 * `pnpm seed:surfaces` already runs this server, but it also creates a
 * group, nine channels and their post history, and it needs the fakeships
 * up before it will start. Publishing needs none of that: `tlon surface
 * create` makes its own channel, and `tlon surface publish` needs somewhere
 * to PUT a bundle. So this entry point starts the storage half alone.
 *
 * It is not selected by anything. `tlon surface publish` reaches it only
 * when TLON_SURFACE_DEV_STORAGE names it, and the CLI refuses to engage
 * dev storage against a non-loopback ship — a developer who never sets the
 * variable gets the same `storage-unavailable` error as before, and a
 * developer pointed at a real ship gets a refusal rather than a surprise.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const port = Number(flagValue(args, '--port') ?? DEFAULT_BUNDLE_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`bad --port: ${flagValue(args, '--port')}`);
    process.exit(1);
  }
  const outDir = path.resolve(
    flagValue(args, '--out') ?? path.join(here, 'served')
  );

  const server = await startBundleServer({ bundles: [], outDir, port });

  console.log('\n=== surface dev storage ===\n');
  console.log(`  origin:  ${server.origin}`);
  console.log(`  objects: ${outDir}`);
  console.log(`  keys:    ${UPLOAD_KEY_PATTERN.source}`);
  console.log('\nPoint the CLI at it:\n');
  console.log(`  export TLON_SURFACE_DEV_STORAGE=${server.origin}`);
  console.log(
    '\nThen `tlon surface publish` stores bundles here instead of the'
  );
  console.log("ship's remote storage. Ctrl+C to stop.\n");

  const stop = () => {
    void server.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

void main();
