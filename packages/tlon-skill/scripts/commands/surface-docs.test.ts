import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { createTestSurfaceDeps } from '../surface-test-doubles';
import { surfaceSkillDir } from '../surface-docs-runtime';
import {
  SURFACE_DOCUMENT_IDS,
  type SurfaceDocumentId,
  surfaceDocumentPath,
} from './surface-docs';
import { SURFACE_SUBCOMMANDS, run } from './surface';

/**
 * The doctrine commands, tested for the one property they exist to hold:
 * that running them yields THE document, not merely output.
 *
 * A test asserting non-empty output or exit 0 would pass if the command
 * printed its own help, printed the wrong document, or printed a truncated
 * one — so every assertion here is either a line that could only have come
 * from one specific file, or the file's own bytes.
 */

const ANCHORS: Record<SurfaceDocumentId, string[]> = {
  doctrine: ['# The surface paradigm', '## 1. The contract'],
  primitives: ['# The primitive kit', '## The `surface` global'],
  rubric: ['# The preview rubric', '## What preview gives you'],
};

/**
 * Which file each command must serve, spelled out here rather than read from
 * `SURFACE_DOCUMENTS`. Asking the implementation which file it means and then
 * checking it served that file is a tautology: it holds just as well when the
 * mapping is wrong.
 */
const EXPECTED_FILE: Record<SurfaceDocumentId, string> = {
  doctrine: 'PARADIGM.md',
  primitives: 'PRIMITIVES.md',
  rubric: 'RUBRIC.md',
};

/** The heading that identifies each document, and only that document. */
const IDENTIFYING_HEADING: Record<SurfaceDocumentId, string> = {
  doctrine: ANCHORS.doctrine[0],
  primitives: ANCHORS.primitives[0],
  rubric: ANCHORS.rubric[0],
};

const SKILL_MD = path.join(surfaceSkillDir(), 'SKILL.md');

async function withSkillDir<T>(
  dir: string,
  body: () => Promise<T>
): Promise<T> {
  const previous = process.env.TLON_SURFACE_SKILL_DIR;
  process.env.TLON_SURFACE_SKILL_DIR = dir;
  try {
    return await body();
  } finally {
    if (previous === undefined) delete process.env.TLON_SURFACE_SKILL_DIR;
    else process.env.TLON_SURFACE_SKILL_DIR = previous;
  }
}

const scratchDirs: string[] = [];

function scratchDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-docs-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (scratchDirs.length > 0) {
    const dir = scratchDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('surface doctrine/primitives/rubric — the document, not just output', () => {
  for (const id of SURFACE_DOCUMENT_IDS) {
    it(`prints ${EXPECTED_FILE[id]} for "${id}"`, async () => {
      const harness = createTestSurfaceDeps({});
      expect(await run([id], harness.deps)).toBe(0);
      for (const anchor of ANCHORS[id]) {
        expect(harness.out()).toContain(anchor);
      }
      expect(harness.err()).toBe('');
    });

    it(`cannot pass another document's assertion for "${id}"`, async () => {
      const harness = createTestSurfaceDeps({});
      await run([id], harness.deps);
      for (const other of SURFACE_DOCUMENT_IDS) {
        if (other === id) continue;
        expect(harness.out()).not.toContain(IDENTIFYING_HEADING[other]);
      }
    });

    it(`serves "${id}" byte-for-byte, not a summary of it`, async () => {
      expect(surfaceDocumentPath(id)).toBe(
        path.join(surfaceSkillDir(), EXPECTED_FILE[id])
      );
      const harness = createTestSurfaceDeps({});
      await run([id], harness.deps);
      const source = fs.readFileSync(
        path.join(surfaceSkillDir(), EXPECTED_FILE[id]),
        'utf-8'
      );
      expect(harness.out()).toBe(`${source.replace(/\n+$/, '')}\n`);
    });

    it(`reports "${id}" as a machine-readable document under --json`, async () => {
      const harness = createTestSurfaceDeps({});
      expect(await run([id, '--json'], harness.deps)).toBe(0);
      const result = harness.json();
      expect(result.ok).toBe(true);
      expect(result.document).toBe(id);
      expect(result.file).toBe(EXPECTED_FILE[id]);
      expect(result.path).toBe(path.join(surfaceSkillDir(), EXPECTED_FILE[id]));
      expect(result.text).toBe(
        fs.readFileSync(
          path.join(surfaceSkillDir(), EXPECTED_FILE[id]),
          'utf-8'
        )
      );
      expect(result.bytes).toBe(
        Buffer.byteLength(result.text as string, 'utf-8')
      );
    });
  }
});

describe('surface doctrine — a missing document is loud', () => {
  it('names the path it looked in rather than printing nothing', async () => {
    const empty = scratchDir();
    const harness = createTestSurfaceDeps({});
    const exitCode = await withSkillDir(empty, () =>
      run(['doctrine', '--json'], harness.deps)
    );
    expect(exitCode).toBe(1);
    const result = harness.json();
    expect(result.ok).toBe(false);
    expect(result.code).toBe('doctrine-unavailable');
    expect(result.message).toContain(path.join(empty, 'PARADIGM.md'));
    expect((result.details as Record<string, unknown>).errorClass).toBe(
      'environment'
    );
  });

  it('refuses an empty document instead of serving silence', async () => {
    const dir = scratchDir();
    fs.writeFileSync(path.join(dir, 'RUBRIC.md'), '\n\n', 'utf-8');
    const harness = createTestSurfaceDeps({});
    const exitCode = await withSkillDir(dir, () =>
      run(['rubric', '--json'], harness.deps)
    );
    expect(exitCode).toBe(1);
    expect(harness.json().code).toBe('doctrine-unavailable');
  });

  it('serves whatever the resolved directory holds, so the resolution is real', async () => {
    const dir = scratchDir();
    fs.writeFileSync(
      path.join(dir, 'PARADIGM.md'),
      '# Not the real paradigm\n',
      'utf-8'
    );
    const harness = createTestSurfaceDeps({});
    const exitCode = await withSkillDir(dir, () =>
      run(['doctrine'], harness.deps)
    );
    expect(exitCode).toBe(0);
    expect(harness.out()).toBe('# Not the real paradigm\n');
  });
});

describe('surface doctrine — usage', () => {
  it('shows help without reading the filesystem', async () => {
    const empty = scratchDir();
    for (const id of SURFACE_DOCUMENT_IDS) {
      const harness = createTestSurfaceDeps({});
      const exitCode = await withSkillDir(empty, () =>
        run([id, '--help'], harness.deps)
      );
      expect(exitCode).toBe(0);
      expect(harness.out()).toContain(`Usage: tlon surface ${id}`);
      expect(harness.err()).toBe('');
    }
  });

  it('refuses an unexpected argument', async () => {
    const harness = createTestSurfaceDeps({});
    expect(await run(['doctrine', 'section-3', '--json'], harness.deps)).toBe(
      1
    );
    expect(harness.json().code).toBe('usage');
  });
});

/**
 * The reachability property, checked as a property rather than asserted in a
 * report: SKILL.md is the ONLY file a Hermes-hosted bot is served, so every
 * `tlon surface …` command it names has to exist, and the three documents
 * have to be reachable from it. Either half drifting silently re-opens D74.
 */
describe('SKILL.md is a working index of the CLI', () => {
  const skill = fs.readFileSync(SKILL_MD, 'utf-8');

  it('names only surface subcommands that exist', () => {
    const named = new Set(
      [...skill.matchAll(/`tlon surface ([a-z-]+)/g)].map(
        (match) => match[1] as string
      )
    );
    expect(named.size).toBeGreaterThan(0);
    for (const subcommand of named) {
      expect(SURFACE_SUBCOMMANDS).toContain(
        subcommand as (typeof SURFACE_SUBCOMMANDS)[number]
      );
    }
  });

  it('reaches every packaged document through a command', () => {
    for (const id of SURFACE_DOCUMENT_IDS) {
      expect(skill).toContain(`tlon surface ${id}`);
    }
  });

  it('does not send the bot to a file path the skill mechanism may not serve', () => {
    // The documents may be *named* (they are what the commands print), but
    // never handed over as something to open: under Hermes an ordinary read
    // of PARADIGM.md is exactly what is unavailable.
    for (const id of SURFACE_DOCUMENT_IDS) {
      const file = EXPECTED_FILE[id];
      expect(skill).not.toContain(`Read \`${file}\``);
      expect(skill).not.toContain(`skills/surfaces/${file}`);
    }
  });
});
