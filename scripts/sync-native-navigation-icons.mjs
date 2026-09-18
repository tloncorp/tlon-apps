import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const sourceDirectory = path.join(
  rootDirectory,
  'packages/ui/src/assets/icons'
);
const iosHeaderAssetDirectory = path.join(
  rootDirectory,
  'apps/tlon-mobile/ios/Landscape/HeaderIcons.xcassets'
);
const checkOnly = process.argv.includes('--check');

const screenHeaderIcons = JSON.parse(
  await readFile(
    path.join(
      rootDirectory,
      'packages/app/ui/components/ScreenHeader/icons.json'
    ),
    'utf8'
  )
);
const iosHeaderIcons = Object.entries(screenHeaderIcons).map(
  ([iconName, sourceName]) => [sourceName, `TlonHeader${iconName}`]
);

const normalizeSvgColor = (svg) =>
  svg.replaceAll('currentColor', '#000000').replaceAll(/#1A1818/gi, '#000000');

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const iosImageSetContents = (fileName) => ({
  images: [{ filename: fileName, idiom: 'universal' }],
  info: { author: 'xcode', version: 1 },
  properties: {
    'preserves-vector-representation': true,
    'template-rendering-intent': 'template',
  },
});

// iOS native-stack headers resolve named template vectors from an asset
// catalog, so the source SVGs are normalized and written through unchanged.
async function buildIOSHeaderAssets() {
  const files = new Map([
    ['Contents.json', json({ info: { author: 'xcode', version: 1 } })],
  ]);

  for (const [sourceName, assetName] of iosHeaderIcons) {
    const imageSet = `${assetName}.imageset`;
    const targetName = `${assetName}.svg`;
    const source = normalizeSvgColor(
      await readFile(path.join(sourceDirectory, sourceName), 'utf8')
    );

    files.set(
      path.join(imageSet, 'Contents.json'),
      json(iosImageSetContents(targetName))
    );
    files.set(path.join(imageSet, targetName), source);
  }

  return files;
}

async function listFiles(directory) {
  const files = [];

  async function visit(currentDirectory) {
    let entries;
    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else {
        files.push(path.relative(directory, entryPath));
      }
    }
  }

  await visit(directory);
  return files.sort();
}

async function syncTarget({ name, directory, build }) {
  const files = await build();
  const mismatches = [];

  if (checkOnly) {
    const actualFiles = await listFiles(directory);
    const expectedFiles = [...files.keys()].sort();

    if (actualFiles.join('\n') !== expectedFiles.join('\n')) {
      mismatches.push('file list');
    }

    for (const [fileName, contents] of files) {
      const expected = Buffer.isBuffer(contents)
        ? contents
        : Buffer.from(contents);
      try {
        const actual = await readFile(path.join(directory, fileName));
        if (!actual.equals(expected)) {
          mismatches.push(fileName);
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          mismatches.push(fileName);
        } else {
          throw error;
        }
      }
    }
  } else {
    await rm(directory, { recursive: true, force: true });

    for (const [fileName, contents] of files) {
      const filePath = path.join(directory, fileName);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, contents);
    }
  }

  if (mismatches.length > 0) {
    console.error(`${name} are out of date:`);
    for (const fileName of mismatches) {
      console.error(
        `  ${path.relative(rootDirectory, path.join(directory, fileName))}`
      );
    }
    console.error(
      '\nRun pnpm sync:native-navigation-icons and commit the result.'
    );
    process.exitCode = 1;
  } else {
    console.log(
      checkOnly ? `${name} are up to date.` : `Synced ${name.toLowerCase()}.`
    );
  }
}

await syncTarget({
  name: 'Native header icons',
  directory: iosHeaderAssetDirectory,
  build: buildIOSHeaderAssets,
});
