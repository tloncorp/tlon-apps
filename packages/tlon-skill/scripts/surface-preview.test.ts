import { describe, expect, it } from 'bun:test';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as shellArtifactModule from '@tloncorp/surface-shell/artifact-strings';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as shellSandboxModule from '@tloncorp/surface-shell/sandbox';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { PreviewCellObservation } from './surface-preview-defects';
import {
  PREVIEW_ACTORS,
  PREVIEW_FULL_HEIGHT,
  PREVIEW_RUBRIC_TEMPLATE_FILE,
  type PreviewBrowser,
  type PreviewContext,
  type PreviewFrame,
  type PreviewLauncher,
  type PreviewPage,
  type SurfaceSpec,
  assemblePreviewDocument,
  buildInitMessage,
  buildPreviewHostPage,
  cellId,
  foldPopulatedState,
  previewMatrix,
  previewViewports,
  renderSurfacePreview,
} from './surface-preview';
import { RUBRIC_CELL_IDS } from './surface-rubric-artifact';

// bun test runs from the package root
const repoRoot = join(process.cwd(), '..', '..');
const shellRoot = join(repoRoot, 'packages', 'surface-shell');

const { buildSandboxDocument } = shellSandboxModule as {
  buildSandboxDocument(options: {
    shellJs: string;
    shellCss: string;
    bundleSource: string;
  }): string;
};
const { shellArtifactJs, shellArtifactCss } = shellArtifactModule as {
  shellArtifactJs: string;
  shellArtifactCss: string;
};

function pollSpec(): SurfaceSpec {
  return JSON.parse(
    readFileSync(join(shellRoot, 'fixtures', 'poll', 'spec.json'), 'utf8')
  ) as SurfaceSpec;
}

function pollBundle(): string {
  return readFileSync(join(shellRoot, 'fixtures', 'poll', 'app.js'), 'utf8');
}

/* ------------------------------------------------------------------ */
/* preview renders what production renders                             */
/* ------------------------------------------------------------------ */

describe('assembled document identity', () => {
  it('is byte-equal to the assembly packages/app performs', () => {
    const bundleSource = pollBundle();
    expect(assemblePreviewDocument(bundleSource)).toBe(
      buildSandboxDocument({
        shellJs: shellArtifactJs,
        shellCss: shellArtifactCss,
        bundleSource,
      })
    );
  });

  it('embeds the same shell bytes the app ships, not a dev build', () => {
    expect(shellArtifactJs).toBe(
      readFileSync(join(shellRoot, 'dist', 'surface-shell.js'), 'utf8')
    );
    expect(shellArtifactCss).toBe(
      readFileSync(join(shellRoot, 'dist', 'surface-shell.css'), 'utf8')
    );
  });

  /**
   * The claim "preview equals production by construction" is only true
   * while production still constructs it the same way. This reads the
   * renderer and fails if it stops importing the shared assembler or the
   * embedded artifact — the two moves that would silently make preview a
   * lookalike. Skipped when the app package is absent (a released skill
   * tarball ships without it).
   */
  it('is assembled by the same imports packages/app uses', () => {
    const container = join(
      repoRoot,
      'packages',
      'app',
      'ui',
      'components',
      'SurfaceChannel',
      'SurfaceSandboxContainer.tsx'
    );
    if (!existsSync(container)) {
      return;
    }
    const source = readFileSync(container, 'utf8');
    expect(source).toContain(
      "import { buildSandboxDocument } from '@tloncorp/surface-shell/sandbox'"
    );
    expect(source).toContain("from '@tloncorp/surface-shell/artifact-strings'");
    expect(source).toContain('shellJs: shellArtifactJs');
    expect(source).toContain('shellCss: shellArtifactCss');
  });

  it('carries the production CSP and loads the shell before the bundle', () => {
    const document = assemblePreviewDocument('/* bundle */');
    expect(document).toContain(
      `content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"`
    );
    expect(document.indexOf(shellArtifactJs.slice(0, 64))).toBeLessThan(
      document.indexOf('/* bundle */')
    );
  });
});

/* ------------------------------------------------------------------ */
/* the host page                                                       */
/* ------------------------------------------------------------------ */

describe('preview host page', () => {
  it('mounts the frame with scripts only and no same-origin', () => {
    const page = buildPreviewHostPage('light');
    expect(page).toContain('payload.flags');
    expect(page).not.toContain('allow-same-origin');
    // srcdoc is set before insertion, as React does: an in-document
    // assignment produces a second about:blank load on chromium/webkit
    expect(page.indexOf("setAttribute('srcdoc'")).toBeLessThan(
      page.indexOf('appendChild(frame)')
    );
  });

  it('only listens to its own frame', () => {
    expect(buildPreviewHostPage('light')).toContain(
      'event.source !== frame.contentWindow'
    );
  });

  it('takes its surround from the shell token for the captured theme', () => {
    const dark = buildPreviewHostPage('dark');
    expect(dark).toContain('<html data-theme="dark">');
    expect(dark).toContain('background: var(--color-bg)');
    // the built stylesheet is minified, so the selector loses its quotes
    expect(dark).toContain('[data-theme=dark]{--color-bg: #1A1818');
    expect(buildPreviewHostPage('light')).toContain(
      '<html data-theme="light">'
    );
  });
});

describe('init message', () => {
  it('validates against the shell’s own host-message schema', () => {
    const spec = pollSpec();
    const message = buildInitMessage({
      spec,
      state: spec.initialState,
      theme: 'dark',
      canInvoke: true,
    });
    expect(message.type).toBe('init');
    expect(message.protocolVersion).toBe(1);
    expect(message.theme).toBe('dark');
  });

  it('refuses to post a message the shell would reject', () => {
    const spec = { ...pollSpec(), surfaceId: '' } as SurfaceSpec;
    expect(() =>
      buildInitMessage({
        spec,
        state: {},
        theme: 'light',
        canInvoke: true,
      })
    ).toThrow(/init the shell would reject/);
  });
});

/* ------------------------------------------------------------------ */
/* the populated state                                                 */
/* ------------------------------------------------------------------ */

describe('foldPopulatedState', () => {
  it('folds every declared action, rotating the synthetic crew', () => {
    const spec = pollSpec();
    const folded = foldPopulatedState(spec);
    expect(folded.invokes).toHaveLength(Object.keys(spec.actions).length * 2);
    expect(folded.invokes.map((invoke) => invoke.actionId)).toEqual([
      'vote-pizza',
      'vote-tacos',
      'vote-pizza',
      'vote-tacos',
    ]);
    expect(new Set(folded.invokes.map((invoke) => invoke.actor))).toEqual(
      new Set(PREVIEW_ACTORS)
    );
  });

  it('produces a state the real reducer built from $actor', () => {
    const folded = foldPopulatedState(pollSpec());
    expect(folded.unchanged).toBe(false);
    // every vote is keyed by a synthetic actor, which only the reducer's
    // $actor substitution can have written
    const votes = folded.state.votes as Record<string, string>;
    expect(Object.keys(votes).sort()).toEqual([...PREVIEW_ACTORS].sort());
  });

  it('honours the round count', () => {
    const folded = foldPopulatedState(pollSpec(), { rounds: 3 });
    expect(folded.invokes).toHaveLength(6);
  });

  it('reports a spec that declares no actions instead of pretending', () => {
    const folded = foldPopulatedState({ ...pollSpec(), actions: {} });
    expect(folded.problem).toContain('no actions');
    expect(folded.unchanged).toBe(true);
  });

  /**
   * Without the stand-in snapshot a preserving spec reduces to
   * migration-pending and the populated capture would show an empty app
   * for a reason that has nothing to do with the app.
   */
  it('stands in the host migration snapshot for a preserving spec', () => {
    const folded = foldPopulatedState({ ...pollSpec(), preserveState: true });
    expect(folded.problem).toBeUndefined();
    expect(Object.keys(folded.state.votes as object)).not.toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* the matrix                                                          */
/* ------------------------------------------------------------------ */

describe('previewMatrix', () => {
  it('puts phone first and covers both themes and both states', () => {
    const cells = previewMatrix(['initial', 'populated']);
    expect(cells).toHaveLength(12);
    expect(cells.slice(0, 4).map((cell) => cell.viewport.name)).toEqual([
      'phone',
      'phone',
      'phone',
      'phone',
    ]);
    expect(cells[0].viewport.width).toBe(390);
    expect(cells[0].viewport.height).toBe(844);
    expect(cells.map((cell) => cell.file)).toContain(
      'phone-populated-dark.png'
    );
    expect(new Set(cells.map((cell) => cell.theme))).toEqual(
      new Set(['light', 'dark'])
    );
  });

  it('drops the populated cells when only the initial state is captured', () => {
    expect(previewMatrix(['initial'])).toHaveLength(6);
  });

  it('sizes the fold-free phone cell from the requested height', () => {
    expect(previewViewports()[1].height).toBe(PREVIEW_FULL_HEIGHT);
    expect(previewViewports(1234)[1]).toMatchObject({
      name: 'phone-full',
      width: 390,
      height: 1234,
    });
  });
});

/* ------------------------------------------------------------------ */
/* the driver, against a stand-in browser                              */
/* ------------------------------------------------------------------ */

interface RecordedPage {
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  colorScheme: string;
  reducedMotion: string;
  host: string;
  mounted: { document: string; flags: string; init: string } | null;
  screenshot: string | null;
  probeExpressions: string[];
}

/**
 * A clean measurement: nothing past the edge, one comfortable control, no
 * denylisted word. This is the "good bundle" arm of the defect-pass control,
 * and it has to be a real observation rather than an empty object — a stand-in
 * that could not express a defect would make the whole pass untestable, which
 * is the trap the brief names.
 */
function cleanObservation(): PreviewCellObservation {
  return {
    viewportWidth: 390,
    viewportHeight: 844,
    documentScrollWidth: 390,
    overflowing: [],
    controls: [
      {
        descriptor: 'button.tsh-button',
        text: 'Add a session',
        left: 16,
        right: 200,
        top: 300,
        bottom: 342,
        width: 184,
        height: 42,
        clipped: false,
      },
    ],
    text: 'This week Add a session Nobody has logged one yet.',
  };
}

function fakeLauncher(
  options: {
    errors?: { phase: string; message: string }[];
    /** what the probe brings back from the app frame, per cell */
    observation?: PreviewCellObservation | null;
    /** the app frame throws instead of answering */
    probeThrows?: string;
  } = {}
): { launcher: PreviewLauncher; pages: RecordedPage[] } {
  const pages: RecordedPage[] = [];

  const makePage = (record: RecordedPage): PreviewPage => {
    const hostFrame: PreviewFrame = {
      // The host page has no shell root, which is how the real probe tells
      // the two frames apart.
      async evaluate() {
        return null;
      },
    };
    const appFrame: PreviewFrame = {
      async evaluate(expression) {
        record.probeExpressions.push(expression);
        if (options.probeThrows !== undefined) {
          throw new Error(options.probeThrows);
        }
        return options.observation === undefined
          ? cleanObservation()
          : options.observation;
      },
    };
    return {
      async setContent(html) {
        record.host = html;
      },
      async evaluate(_fn, arg) {
        if (arg === undefined) {
          return { errors: options.errors ?? [] };
        }
        record.mounted = arg as RecordedPage['mounted'];
        return undefined;
      },
      async waitForFunction() {
        return undefined;
      },
      async waitForTimeout() {},
      async screenshot({ path }) {
        record.screenshot = path;
        mkdirForFile(path);
        writeFileSync(path, 'png');
        return undefined;
      },
      mainFrame() {
        return hostFrame;
      },
      frames() {
        return [hostFrame, appFrame];
      },
      async close() {},
    };
  };

  const browser: PreviewBrowser = {
    async newContext(contextOptions) {
      const record: RecordedPage = {
        viewport: contextOptions.viewport,
        deviceScaleFactor: contextOptions.deviceScaleFactor,
        colorScheme: contextOptions.colorScheme,
        reducedMotion: contextOptions.reducedMotion,
        host: '',
        mounted: null,
        screenshot: null,
        probeExpressions: [],
      };
      pages.push(record);
      const context: PreviewContext = {
        async newPage() {
          return makePage(record);
        },
        async close() {},
      };
      return context;
    },
    async close() {},
  };

  return {
    launcher: {
      async launch() {
        return browser;
      },
    },
    pages,
  };
}

function mkdirForFile(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function outDir(): string {
  return mkdtempSync(join(tmpdir(), 'surface-preview-'));
}

describe('renderSurfacePreview', () => {
  it('captures the whole matrix and writes a manifest', async () => {
    const { launcher, pages } = fakeLauncher();
    const dir = outDir();
    const outcome = await renderSurfacePreview({
      bundleSha256: '0'.repeat(64),
      bundleSource: pollBundle(),
      spec: pollSpec(),
      outDir: dir,
      launcher,
    });

    expect(outcome.shots).toHaveLength(12);
    expect(pages).toHaveLength(12);
    expect(pages[0].viewport).toEqual({ width: 390, height: 844 });
    expect(pages.every((page) => page.reducedMotion === 'reduce')).toBe(true);
    // the tall cell is rendered at 1x on purpose
    expect(pages[4].viewport.height).toBe(PREVIEW_FULL_HEIGHT);
    expect(pages[4].deviceScaleFactor).toBe(1);
    expect(pages[0].deviceScaleFactor).toBe(2);

    expect(existsSync(outcome.manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(outcome.manifestPath, 'utf8'));
    expect(manifest.surfaceId).toBe('srf-poll-fixture');
    expect(manifest.actors).toEqual([...PREVIEW_ACTORS]);
    expect(manifest.rubric).toBe('skills/surfaces/RUBRIC.md');
    expect(manifest.shots).toHaveLength(12);
    expect(manifest.shellErrors).toEqual([]);
  });

  it('mounts the production document and posts a themed init per cell', async () => {
    const { launcher, pages } = fakeLauncher();
    const bundleSource = pollBundle();
    await renderSurfacePreview({
      bundleSource,
      bundleSha256: '0'.repeat(64),
      spec: pollSpec(),
      outDir: outDir(),
      launcher,
    });

    const document = assemblePreviewDocument(bundleSource);
    for (const page of pages) {
      expect(page.mounted?.document).toBe(document);
      expect(page.mounted?.flags).toBe('allow-scripts');
      const init = JSON.parse(page.mounted?.init ?? '{}');
      expect(init.type).toBe('init');
      expect(init.theme).toBe(page.colorScheme);
      expect(init.canInvoke).toBe(true);
    }
    // the populated cells carry the folded state, the initial ones do not
    const states = pages.map(
      (page) => JSON.parse(page.mounted?.init ?? '{}').state.votes
    );
    expect(
      states.filter((votes) => Object.keys(votes).length > 0)
    ).toHaveLength(6);
  });

  it('renders a read-only member when asked', async () => {
    const { launcher, pages } = fakeLauncher();
    await renderSurfacePreview({
      bundleSha256: '0'.repeat(64),
      bundleSource: pollBundle(),
      spec: pollSpec(),
      outDir: outDir(),
      canInvoke: false,
      launcher,
    });
    const init = JSON.parse(pages[0].mounted?.init ?? '{}');
    expect(init.canInvoke).toBe(false);
  });

  it('reports shell errors per cell rather than swallowing them', async () => {
    const { launcher } = fakeLauncher({
      errors: [{ phase: 'render', message: 'boom' }],
    });
    const outcome = await renderSurfacePreview({
      bundleSha256: '0'.repeat(64),
      bundleSource: pollBundle(),
      spec: pollSpec(),
      outDir: outDir(),
      launcher,
    });
    expect(outcome.manifest.shellErrors).toHaveLength(12);
    expect(outcome.manifest.shellErrors[0]).toEqual({
      cell: 'phone-initial-light.png',
      phase: 'render',
      message: 'boom',
    });
  });

  it('rejects a spec the real schema refuses', async () => {
    const { launcher } = fakeLauncher();
    await expect(
      renderSurfacePreview({
        bundleSource: pollBundle(),
        bundleSha256: '0'.repeat(64),
        spec: { ...pollSpec(), specRevision: -1 },
        outDir: outDir(),
        launcher,
      })
    ).rejects.toThrow(/not a valid surface spec/);
  });

  /**
   * Two repair rounds mean the directory is written twice. A shot left
   * behind from the previous round — because the app now renders fewer
   * cells, or because capture failed — would be scored as if it were this
   * round's output.
   */
  it('clears the previous round’s shots before capturing', async () => {
    const dir = outDir();
    const stale = join(dir, 'phone-populated-dark.png');
    writeFileSync(stale, 'stale');
    const { launcher } = fakeLauncher();
    await renderSurfacePreview({
      bundleSha256: '0'.repeat(64),
      bundleSource: pollBundle(),
      spec: pollSpec(),
      outDir: dir,
      includePopulated: false,
      launcher,
    });
    expect(existsSync(stale)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* the real browser                                                    */
/* ------------------------------------------------------------------ */

/**
 * The headless proof, opt-in so the suite stays runnable on a machine with
 * no browser binaries. CI runs it with TLON_PREVIEW_BROWSER=1 after
 * `npx playwright install chromium`.
 */
const browserTest = process.env.TLON_PREVIEW_BROWSER === '1' ? it : it.skip;

describe('headless capture', () => {
  browserTest(
    'renders the poll fixture through real chromium',
    async () => {
      const dir = outDir();
      const outcome = await renderSurfacePreview({
        bundleSource: pollBundle(),
        bundleSha256: '0'.repeat(64),
        spec: pollSpec(),
        outDir: dir,
      });
      expect(outcome.manifest.shellErrors).toEqual([]);
      for (const shot of outcome.shots) {
        expect(existsSync(shot.path)).toBe(true);
        // a PNG, not a zero-byte placeholder
        expect(readFileSync(shot.path).byteLength).toBeGreaterThan(1000);
      }
    },
    120_000
  );
});

/* ------------------------------------------------------------------ */
/* the machine defect pass                                             */
/* ------------------------------------------------------------------ */

/**
 * A deliberately bad app, in the shape a generating model actually produces
 * one: two vote buttons crowded onto a row, a strip wider than a phone, and a
 * sentence that describes the machine instead of the subject.
 *
 * It is a REAL bundle — it registers with the real shell and renders through
 * the real primitives — because a control whose bad arm is a hand-written
 * measurement only proves the arithmetic. The `TLON_PREVIEW_BROWSER` test at
 * the bottom of this file runs this through actual Chromium.
 */
const DEFECTIVE_BUNDLE = `(function () {
  const { html, primitives } = surface;
  const { Card, Button } = primitives;
  surface.register({
    render(state) {
      return html\`
        <\${Card} title="Zine board">
          <div style="display: flex; gap: 2px;">
            <\${Button}>Approve<//>
            <\${Button}>Reject<//>
          </div>
          <div style="width: 620px">\${state.note || 'wide strip'}</div>
          <p>3 pages since the last rollover</p>
        <//>
      \`;
    },
  });
})();`;

function defectiveSpec(): SurfaceSpec {
  return {
    version: 1,
    surfaceId: 'srf-defective-fixture',
    specRevision: 1,
    title: 'Zine board',
    bundle: {
      assetRef: 'fixture://defective/app.js',
      sha256: 'b'.repeat(64),
      size: 512,
      shellVersion: 1,
    },
    initialState: { note: 'a strip that is much wider than a phone' },
    actions: {
      approve: { ops: [{ op: 'set', path: '/note', value: 'approved' }] },
    },
  } as unknown as SurfaceSpec;
}

/** A cell whose layout metrics and copy are all findings. */
function defectiveObservation(): PreviewCellObservation {
  return {
    viewportWidth: 390,
    viewportHeight: 844,
    documentScrollWidth: 636,
    overflowing: [
      {
        descriptor: 'div',
        text: 'a strip that is much wider than a phone',
        left: 16,
        right: 636,
        top: 400,
        bottom: 424,
        width: 620,
        height: 24,
        clipped: false,
      },
    ],
    controls: [
      {
        descriptor: 'button.tsh-button',
        text: 'Approve',
        left: 16,
        right: 120,
        top: 300,
        bottom: 342,
        width: 104,
        height: 42,
        clipped: false,
      },
      {
        descriptor: 'button.tsh-button',
        text: 'Reject',
        left: 122,
        right: 226,
        top: 300,
        bottom: 342,
        width: 104,
        height: 42,
        clipped: false,
      },
    ],
    text: 'Zine board Approve Reject a strip 3 pages since the last rollover',
  };
}

describe('renderSurfacePreview — the defect pass reaches the manifest', () => {
  it('finds nothing in a clean render, and says what it did not check', async () => {
    const { launcher } = fakeLauncher();
    const outcome = await renderSurfacePreview({
      bundleSource: pollBundle(),
      bundleSha256: 'd'.repeat(64),
      spec: pollSpec(),
      outDir: outDir(),
      launcher,
    });
    expect(outcome.manifest.defects).toEqual([]);
    expect(outcome.manifest.unprobedCells).toEqual([]);
    expect(outcome.manifest.notChecked.length).toBeGreaterThan(3);
  });

  it('carries every defect, grouped, with the cells it was seen in', async () => {
    // Same command, same fixture, ONE thing different: what the app frame
    // measured. That is the fulcrum, and this is the arm that moves it.
    const { launcher } = fakeLauncher({
      observation: defectiveObservation(),
    });
    const outcome = await renderSurfacePreview({
      bundleSource: DEFECTIVE_BUNDLE,
      bundleSha256: 'e'.repeat(64),
      spec: defectiveSpec(),
      outDir: outDir(),
      launcher,
    });

    const byCheck = outcome.manifest.defects.map((defect) => defect.check);
    expect(byCheck).toContain('overflow');
    expect(byCheck).toContain('tap-targets');
    expect(byCheck).toContain('no-jargon');
    // Every cell rendered, so every cell saw it — grouped to one line each.
    for (const defect of outcome.manifest.defects) {
      expect(defect.cells).toHaveLength(12);
    }
  });

  it('reports an unmeasurable cell as unmeasured, never as clean', async () => {
    // The vacuity guard. A probe that silently failed would report zero
    // defects for every app forever and look exactly like a passing run.
    const { launcher } = fakeLauncher({
      probeThrows: 'Execution context was destroyed',
    });
    const outcome = await renderSurfacePreview({
      bundleSource: pollBundle(),
      bundleSha256: 'f'.repeat(64),
      spec: pollSpec(),
      outDir: outDir(),
      launcher,
    });
    expect(outcome.manifest.defects).toEqual([]);
    expect(outcome.manifest.unprobedCells).toHaveLength(12);
    expect(outcome.manifest.unprobedCells[0].problem).toContain(
      'Execution context was destroyed'
    );
  });

  it('runs the probe in the app frame, not the host frame', async () => {
    const { launcher, pages } = fakeLauncher();
    await renderSurfacePreview({
      bundleSource: pollBundle(),
      bundleSha256: 'a'.repeat(64),
      spec: pollSpec(),
      outDir: outDir(),
      launcher,
    });
    expect(pages).toHaveLength(12);
    for (const page of pages) {
      expect(page.probeExpressions).toHaveLength(1);
      expect(page.probeExpressions[0]).toContain('.tsh-root');
    }
  });
});

describe('renderSurfacePreview — the scoring sheet', () => {
  it('writes a template keyed for the twelve cells and stamped with the hash', async () => {
    const { launcher } = fakeLauncher();
    const dir = outDir();
    const outcome = await renderSurfacePreview({
      bundleSource: pollBundle(),
      bundleSha256: '9'.repeat(64),
      spec: pollSpec(),
      outDir: dir,
      launcher,
    });
    expect(outcome.rubricTemplatePath).toBe(
      join(dir, PREVIEW_RUBRIC_TEMPLATE_FILE)
    );
    const template = JSON.parse(
      readFileSync(outcome.rubricTemplatePath, 'utf8')
    );
    expect(Object.keys(template.cells)).toEqual([...RUBRIC_CELL_IDS]);
    expect(template.bundleSha256).toBe('9'.repeat(64));
    expect(template.surfaceId).toBe(pollSpec().surfaceId);
  });

  it('clears the previous round’s template, which named the previous bytes', async () => {
    const { launcher } = fakeLauncher();
    const dir = outDir();
    const stale = join(dir, PREVIEW_RUBRIC_TEMPLATE_FILE);
    mkdirSync(dir, { recursive: true });
    writeFileSync(stale, '{"version":1,"bundleSha256":"stale"}');
    await renderSurfacePreview({
      bundleSource: pollBundle(),
      bundleSha256: '8'.repeat(64),
      spec: pollSpec(),
      outDir: dir,
      launcher,
    });
    expect(JSON.parse(readFileSync(stale, 'utf8')).bundleSha256).toBe(
      '8'.repeat(64)
    );
  });

  it('agrees with the cell ids surface publish validates against', () => {
    // The duplication check. `surface-rubric-artifact.ts` carries its own copy
    // of the twelve so publish can validate a text file without importing
    // Playwright, the shell artifact and the reducer. Two hand-maintained
    // lists is exactly the drift class 6a's cap incident was, so it is checked
    // rather than hoped for.
    expect(previewMatrix(['initial', 'populated']).map(cellId)).toEqual([
      ...RUBRIC_CELL_IDS,
    ]);
  });
});

describe('headless capture — the defect pass against a real browser', () => {
  browserTest(
    'finds the crowding, the overflow and the jargon in a bad bundle',
    async () => {
      const outcome = await renderSurfacePreview({
        bundleSource: DEFECTIVE_BUNDLE,
        bundleSha256: '1'.repeat(64),
        spec: defectiveSpec(),
        outDir: outDir(),
      });
      // The probe reached the sandbox at all — an opaque-origin srcdoc frame
      // the host page cannot touch. If this ever regresses, every cell goes
      // unprobed and the pass reports a clean bill of health.
      expect(outcome.manifest.unprobedCells).toEqual([]);
      const messages = outcome.manifest.defects.map(
        (defect) => `${defect.check}: ${defect.message}`
      );
      expect(messages.join('\n')).toContain('past the right edge');
      expect(messages.join('\n')).toContain('on the same row');
      expect(messages.join('\n')).toContain('"rollover" is on screen');
    },
    120_000
  );

  browserTest(
    'finds nothing in the poll fixture, measured the same way',
    async () => {
      const outcome = await renderSurfacePreview({
        bundleSource: pollBundle(),
        bundleSha256: '2'.repeat(64),
        spec: pollSpec(),
        outDir: outDir(),
      });
      expect(outcome.manifest.unprobedCells).toEqual([]);
      expect(outcome.manifest.defects).toEqual([]);
    },
    120_000
  );
});
