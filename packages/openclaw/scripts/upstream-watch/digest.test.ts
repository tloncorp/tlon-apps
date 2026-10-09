import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Manifest, buildDigest, gitIn } from './digest.ts';

const manifest: Manifest = {
  configKeys: ['commands.ownerAllowFrom'],
  extensions: ['brave'],
  extraPaths: [
    'package.json',
    'src/state/openclaw-state-db-contract.ts',
    'src/config/zod-schema*.ts',
  ],
  workarounds: [],
  profile: {},
};

const entry = (name: string) => ({
  types: `./dist/plugin-sdk/${name}.d.ts`,
  default: `./dist/plugin-sdk/${name}.js`,
});

let root: string;
let repo: string;
let plugin: string;

function write(base: string, file: string, content: string) {
  mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
  writeFileSync(path.join(base, file), content);
}

function commitAndTag(version: string) {
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
  git('add', '-A');
  git(
    '-c',
    'user.email=watch@example.com',
    '-c',
    'user.name=watch',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    version
  );
  git('-c', 'tag.gpgSign=false', 'tag', `v${version}`);
}

function release(
  version: string,
  {
    engines,
    exportNames,
    schema,
    schemaFile = 'src/state/openclaw-state-db-contract.ts',
    changelog = true,
    changelogText,
    zodLine,
  }: {
    engines: string;
    exportNames: string[];
    schema: number;
    schemaFile?: string;
    changelog?: boolean;
    changelogText?: string;
    zodLine: string;
  }
) {
  rmSync(path.join(repo, 'src'), { recursive: true, force: true });
  write(
    repo,
    'package.json',
    JSON.stringify(
      {
        name: 'openclaw',
        version,
        engines: { node: engines },
        exports: Object.fromEntries(
          exportNames.map((name) => [`./plugin-sdk/${name}`, entry(name)])
        ),
      },
      null,
      2
    )
  );
  for (const name of exportNames) {
    write(
      repo,
      `src/plugin-sdk/${name}.ts`,
      `export const ${name.replace(/-/g, '_')} = '${version}';\n`
    );
  }
  write(
    repo,
    schemaFile,
    `export const OPENCLAW_STATE_SCHEMA_VERSION = ${schema};\n`
  );
  write(
    repo,
    'src/config/zod-schema.ts',
    `const S = z.object({\n${zodLine}\n});\n`
  );
  write(repo, 'extensions/brave/index.ts', `export const v = '${version}';\n`);
  if (changelog) {
    write(
      repo,
      `CHANGELOG/${version}.md`,
      changelogText ??
        `## ${version}\n\n### Highlights\n\n- Thing: restated. (#2, #1)\n\n### Fixes\n\n- Thing: fixed in ${version}. (#1, #2) Thanks @a.\n\n### Complete contribution record\n\n#### Pull requests\n\n- **PR #1**\n`
    );
  }
  commitAndTag(version);
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'upstream-watch-digest-'));
  repo = path.join(root, 'openclaw');
  plugin = path.join(root, 'plugin');
  mkdirSync(repo);
  execFileSync('git', ['init', '-q', repo]);

  const base = ['core', 'config-runtime', 'channel-runtime'];
  release('2026.1.1', {
    engines: '>=22.12.0',
    exportNames: base,
    schema: 3,
    zodLine: '  ownerAllowFrom: z.array(z.string()).optional(),',
  });
  // quiet: nothing on our surface changes; changelog missing
  rmSync(path.join(repo, 'CHANGELOG'), { recursive: true, force: true });
  release('2026.1.2', {
    engines: '>=22.12.0',
    exportNames: base,
    schema: 3,
    changelog: false,
    zodLine: '  ownerAllowFrom: z.array(z.string()).optional(),',
  });
  // loud: a used subpath disappears, Node and the state schema move, the
  // zod line for a config key we write is rewritten, and the schema
  // constant moves to another file under src/state
  release('2026.1.3', {
    engines: '>=24.16.0 <25',
    exportNames: ['core', 'config-runtime', 'routing'],
    schema: 4,
    schemaFile: 'src/state/schema-version.ts',
    zodLine: '  ownerAllowFrom: z.array(OwnerSchema).optional(),',
  });
  const later = {
    engines: '>=24.16.0 <25',
    exportNames: ['core', 'config-runtime', 'routing'],
    schema: 4,
    zodLine: '  ownerAllowFrom: z.array(OwnerSchema).optional(),',
  };
  // a changelog that reads but has no level-3 sections to parse
  release('2026.1.4', {
    ...later,
    changelogText: '## 2026.1.4\n\n## Fixes\n\n- Thing: fixed. (#3)\n',
  });
  release('2026.1.5', {
    ...later,
    changelogText: readFileSync(
      path.join(import.meta.dirname, 'fixtures', 'changelog-9.8.md'),
      'utf8'
    ),
  });

  write(
    plugin,
    'tsconfig.json',
    JSON.stringify({ include: ['src/**/*.ts'], exclude: ['**/*.test.ts'] })
  );
  write(
    plugin,
    'src/index.ts',
    [
      "import { a } from 'openclaw/plugin-sdk/core';",
      "import { b } from 'openclaw/plugin-sdk/channel-runtime';",
      "import { c } from 'openclaw/plugin-sdk/outbound-runtime';",
      "import { d } from 'openclaw/plugin-sdk/routing';",
    ].join('\n')
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const run = (
  prev: string,
  next: string,
  intermediates: string[] = [],
  reportedUnresolved = ['plugin-sdk/already-reported'],
  watched: Manifest = manifest
) =>
  buildDigest({
    git: gitIn(repo),
    prev,
    next,
    intermediates,
    pluginDir: plugin,
    manifest: watched,
    canaryNode: '24.16.0',
    reportedUnresolved,
    drift: { prodPins: { default: '2026.1.1' } },
  });

describe('buildDigest', () => {
  it('stays quiet when our surface does not change', () => {
    const { digest } = run('2026.1.1', '2026.1.2');
    expect(digest.signals.sdkSubpathRemoved.fired).toBe(false);
    expect(digest.signals.engineChanged.fired).toBe(false);
    expect(digest.signals.stateSchemaBumped.fired).toBe(false);
    expect(digest.hints.configKeyInZodDiff.fired).toBe(false);
    expect(digest.missingExtensions).toEqual([]);
  });

  it('records an extension missing at both releases as incomplete', () => {
    const { digest } = run('2026.1.1', '2026.1.3', ['2026.1.2'], [], {
      ...manifest,
      extensions: ['brave', 'lossless'],
    });
    expect(digest.missingExtensions).toEqual(['lossless']);
    expect(digest.incomplete).toContain(
      'extension lossless not found upstream at 2026.1.1 or 2026.1.3'
    );
    expect(
      digest.incomplete.filter((line) => line.startsWith('extension '))
    ).toEqual([
      'extension lossless not found upstream at 2026.1.1 or 2026.1.3',
    ]);
  });

  it('records a missing changelog as incomplete, never as no changes', () => {
    const { digest } = run('2026.1.1', '2026.1.2');
    expect(digest.bullets).toEqual([]);
    expect(digest.incomplete).toEqual(['changelog missing for 2026.1.2']);
  });

  it('records a changelog that parses to no bullets as incomplete', () => {
    const { digest } = run('2026.1.3', '2026.1.5', ['2026.1.4']);
    expect(digest.incomplete).toEqual([
      'no bullets parsed from CHANGELOG/2026.1.4.md',
    ]);
    expect(digest.bullets.length).toBeGreaterThan(0);
    expect(digest.bullets.every((b) => b.release === '2026.1.5')).toBe(true);
  });

  it('fires every hard signal with evidence on a breaking release', () => {
    const { digest, diff } = run('2026.1.1', '2026.1.3', ['2026.1.2']);

    expect(digest.subpaths).toEqual([
      {
        subpath: 'plugin-sdk/channel-runtime',
        class: 'removed-in-next',
        source: 'src/plugin-sdk/channel-runtime.ts',
      },
      {
        subpath: 'plugin-sdk/core',
        class: 'present-both',
        source: 'src/plugin-sdk/core.ts',
      },
      { subpath: 'plugin-sdk/outbound-runtime', class: 'absent-in-both' },
      {
        subpath: 'plugin-sdk/routing',
        class: 'added-in-next',
        source: 'src/plugin-sdk/routing.ts',
      },
    ]);
    expect(digest.unresolvedToReport).toEqual(['plugin-sdk/outbound-runtime']);
    // reported once: a later run with it in state stays quiet about it
    expect(
      run('2026.1.1', '2026.1.3', [], ['plugin-sdk/outbound-runtime']).digest
        .unresolvedToReport
    ).toEqual([]);

    expect(digest.signals.sdkSubpathRemoved).toEqual({
      fired: true,
      evidence: [
        'openclaw/plugin-sdk/channel-runtime is exported at 2026.1.1 but not at 2026.1.3',
      ],
    });
    expect(digest.signals.engineChanged).toMatchObject({
      fired: true,
      prev: '>=22.12.0',
      next: '>=24.16.0 <25',
      canarySatisfies: true,
    });
    expect(digest.signals.stateSchemaBumped).toMatchObject({
      fired: true,
      prev: 3,
      next: 4,
    });
    expect(digest.hints.configKeyInZodDiff.fired).toBe(true);

    // the intermediate's missing changelog is still reported; next's bullets
    // are deduplicated by PR set
    expect(digest.incomplete).toEqual(['changelog missing for 2026.1.2']);
    expect(digest.bullets).toEqual([
      {
        release: '2026.1.3',
        section: 'Highlights',
        text: 'Thing: restated. (#2, #1)',
        prs: [2, 1],
      },
    ]);
    expect(digest.bulletsBeforeDedupe).toBe(2);

    expect(diff).toContain('diff --git a/src/plugin-sdk/channel-runtime.ts');
    expect(diff).toContain('diff --git a/extensions/brave/index.ts');
    expect(diff).not.toContain('src/plugin-sdk/outbound-runtime');
  });
});
