import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  classifySubpaths,
  exportTarget,
  namedSubpaths,
  scanPluginImports,
  subjectOf,
} from './subpaths.ts';

const entry = (name: string) => ({
  types: `./dist/plugin-sdk/${name}.d.ts`,
  default: `./dist/plugin-sdk/${name}.js`,
});

describe('classifySubpaths', () => {
  it('classifies each subpath against both export maps', () => {
    const prev = {
      './plugin-sdk/core': entry('core'),
      './plugin-sdk/going': entry('going'),
    };
    const next = {
      './plugin-sdk/core': entry('core'),
      './plugin-sdk/new': entry('new'),
    };
    expect(
      classifySubpaths(
        ['plugin-sdk/core', 'plugin-sdk/going', 'plugin-sdk/new', 'plugin-sdk'],
        prev,
        next
      )
    ).toEqual([
      {
        subpath: 'plugin-sdk/core',
        class: 'present-both',
        source: 'src/plugin-sdk/core.ts',
      },
      {
        subpath: 'plugin-sdk/going',
        class: 'removed-in-next',
        source: 'src/plugin-sdk/going.ts',
      },
      {
        subpath: 'plugin-sdk/new',
        class: 'added-in-next',
        source: 'src/plugin-sdk/new.ts',
      },
      { subpath: 'plugin-sdk', class: 'absent-in-both' },
    ]);
  });

  it('resolves wildcard export patterns and string targets', () => {
    const exportsMap = {
      '.': './dist/index.js',
      './plugin-sdk/*': { import: './dist/plugin-sdk/*.js' },
    };
    expect(exportTarget(exportsMap, '.')).toBe('./dist/index.js');
    expect(exportTarget(exportsMap, 'plugin-sdk/routing')).toBe(
      './dist/plugin-sdk/routing.js'
    );
    expect(exportTarget(exportsMap, 'other/thing')).toBeUndefined();
  });
});

describe('scanPluginImports', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads the tsconfig include set, minus excludes, bare imports included', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'upstream-watch-scan-'));
    mkdirSync(path.join(dir, 'src/nested'), { recursive: true });
    mkdirSync(path.join(dir, 'test'));
    writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({
        include: ['index.ts', 'src/**/*.ts'],
        exclude: ['test', '**/*.test.ts'],
      })
    );
    writeFileSync(
      path.join(dir, 'index.ts'),
      'import type { A } from \'openclaw/plugin-sdk/core\';\nimport x from "openclaw/plugin-sdk";\n'
    );
    writeFileSync(
      path.join(dir, 'src/nested/a.ts'),
      "export {\n  b,\n} from 'openclaw/plugin-sdk/routing';\nconst m = await import('openclaw/plugin-sdk/runtime');\n"
    );
    writeFileSync(
      path.join(dir, 'src/a.test.ts'),
      "import 'openclaw/plugin-sdk/test-only';\n"
    );
    writeFileSync(
      path.join(dir, 'test/b.ts'),
      "import 'openclaw/plugin-sdk/also-test-only';\n"
    );
    writeFileSync(
      path.join(dir, 'other.ts'),
      "import 'openclaw/plugin-sdk/not-included';\n"
    );

    expect(scanPluginImports(dir).subpaths).toEqual([
      'plugin-sdk',
      'plugin-sdk/core',
      'plugin-sdk/routing',
      'plugin-sdk/runtime',
    ]);
  });
});

describe('namedSubpaths', () => {
  const ours = ['plugin-sdk/config-runtime', 'plugin-sdk/core', 'plugin-sdk'];

  it('matches whole subpath names only', () => {
    expect(
      namedSubpaths(
        '`openclaw/plugin-sdk/config-runtime-snapshot` and `plugin-sdk/core`',
        ours
      )
    ).toEqual(['plugin-sdk/core']);
    expect(
      namedSubpaths('the bare `openclaw/plugin-sdk` barrel', ours)
    ).toEqual(['plugin-sdk']);
  });

  it('reads only the subject of a deprecation, not its replacement', () => {
    const bullet =
      '**Public SDK facades:** use host-prepared prompts through `openclaw/plugin-sdk/core`.';
    expect(namedSubpaths(subjectOf(bullet), ours)).toEqual([]);
    expect(namedSubpaths(bullet, ours)).toEqual(['plugin-sdk/core']);
  });
});
