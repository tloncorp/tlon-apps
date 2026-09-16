import { Resvg } from '@resvg/resvg-js';
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
const tabAssetDirectory = path.join(
  rootDirectory,
  'packages/app/navigation/assets'
);
const iosHeaderAssetDirectory = path.join(
  rootDirectory,
  'apps/tlon-mobile/ios/Landscape/HeaderIcons.xcassets'
);
const checkOnly = process.argv.includes('--check');

// Neither the bot nor the workspaces glyph has a filled variant, so each tab
// draws the same asset in both states — as Settings already does.
//
// Unread is a second asset with a dot baked beneath the glyph, not a native
// badge: UIKit fixes a UITabBarItem badge's size and top-right position, and
// there is no public API to move or shrink it. Every tab renders on the same
// taller canvas so glyphs line up whether or not a dot is present. The dot is
// part of the template image, so it takes the tab's tint like the glyph does;
// keeping it a fixed colour would mean opting the whole icon out of tinting
// and baking glyph colours per state and theme.
const tabIcons = [
  ['SmushStar.svg', 'tab-bot'],
  ['SmushStar.svg', 'tab-bot-unread', { dot: true }],
  ['Channel.svg', 'tab-workspaces'],
  ['Channel.svg', 'tab-workspaces-unread', { dot: true }],
  ['Settings.svg', 'tab-settings'],
];

const TAB_GLYPH_SIZE = 24;
// UITabBar centres the whole image, so the glyph must sit at the canvas's
// vertical centre or every tab rides high. Pad equally above and below; the
// dot lives in the bottom pad.
const TAB_CANVAS_HEIGHT = 34;
const TAB_GLYPH_OFFSET_Y = (TAB_CANVAS_HEIGHT - TAB_GLYPH_SIZE) / 2;
const TAB_DOT_RADIUS = 2;

// Nest the source as-is (its own viewBox scales it, its root attributes such
// as fill="none" survive) inside a fixed canvas, with an optional dot below.
function frameTabGlyph(svg, { dot = false } = {}) {
  const nested = svg
    .replace(/<\?xml[^>]*>\s*/i, '')
    .replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
      const sized = attrs
        .replace(/\swidth="[^"]*"/, ` width="${TAB_GLYPH_SIZE}"`)
        .replace(/\sheight="[^"]*"/, ` height="${TAB_GLYPH_SIZE}"`);
      return `<svg x="0" y="${TAB_GLYPH_OFFSET_Y}"${sized}>`;
    });
  const dotMarkup = dot
    ? `<circle cx="${TAB_GLYPH_SIZE / 2}" cy="${TAB_CANVAS_HEIGHT - TAB_DOT_RADIUS - 0.5}" r="${TAB_DOT_RADIUS}" fill="#000000"/>`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TAB_GLYPH_SIZE}" ` +
    `height="${TAB_CANVAS_HEIGHT}" viewBox="0 0 ${TAB_GLYPH_SIZE} ${TAB_CANVAS_HEIGHT}">` +
    `${nested}${dotMarkup}</svg>`
  );
}

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

async function buildTabAssets() {
  const files = new Map();

  for (const [sourceName, outputName, variant] of tabIcons) {
    const source = frameTabGlyph(
      normalizeSvgColor(
        await readFile(path.join(sourceDirectory, sourceName), 'utf8')
      ),
      variant
    );

    for (const scale of [1, 2, 3]) {
      const suffix = scale === 1 ? '' : `@${scale}x`;
      const png = new Resvg(source, {
        fitTo: { mode: 'width', value: TAB_GLYPH_SIZE * scale },
      })
        .render()
        .asPng();

      files.set(`${outputName}${suffix}.png`, png);
    }
  }

  return files;
}

// Native tabs consume density-specific PNGs from React Native, while iOS
// native-stack headers resolve named template vectors from an asset catalog.
// Keep those format-specific builders separate while sharing source SVG
// normalization and the sync/check lifecycle below.
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
  name: 'Native tab icons',
  directory: tabAssetDirectory,
  build: buildTabAssets,
});

await syncTarget({
  name: 'Native header icons',
  directory: iosHeaderAssetDirectory,
  build: buildIOSHeaderAssets,
});
