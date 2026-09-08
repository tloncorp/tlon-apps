import core from './scroll-stability-web-assets.cjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const {
  assetHash,
  createWebTestIsolationPlugin,
  sourceIdentities,
  snapshotWebSources,
  outputManifest,
  assessBuildReceipt,
  verifyCurrentWebBuild,
  assessProductionAssets,
  buildWebReceipt,
} = core;

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2),
    get = (name) => args[args.indexOf(name) + 1];
  if (
    !args.includes('--build') ||
    !args.includes('--root') ||
    !args.includes('--output') ||
    !args.includes('--receipt')
  )
    throw new Error(
      'Usage: node scripts/scroll-stability-web-assets.mjs --build --root ROOT --output EMPTY_DIR --receipt NEW_JSON'
    );
  const receipt = buildWebReceipt({
    root: get('--root'),
    output: get('--output'),
    receiptPath: get('--receipt'),
  });
  process.stdout.write(`Production build receipt: ${receipt.digest}\n`);
}
