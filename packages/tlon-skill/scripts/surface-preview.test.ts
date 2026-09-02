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

// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceReducerModule from '@tloncorp/api/client/surface/reducer';

import type { PreviewCellObservation } from './surface-preview-defects';
import {
  PREVIEW_ACTORS,
  PREVIEW_FIXED_NOW,
  PREVIEW_FULL_HEIGHT,
  PREVIEW_HOST_SHIP,
  PREVIEW_RUBRIC_TEMPLATE_FILE,
  type PreviewBrowser,
  type PreviewContext,
  type PreviewFrame,
  type PreviewLauncher,
  type PreviewManifest,
  type PreviewPage,
  type SurfaceSpec,
  assemblePreviewDocument,
  buildInitMessage,
  buildPreviewHostPage,
  cellId,
  foldPopulatedState,
  loadChromium,
  parseHostOps,
  previewMatrix,
  previewViewports,
  renderSurfacePreview,
} from './surface-preview';
import { RUBRIC_CELL_IDS } from './surface-rubric-artifact';

// bun test runs from the package root
const repoRoot = join(process.cwd(), '..', '..');
const shellRoot = join(repoRoot, 'packages', 'surface-shell');

const { reduceSurface } = surfaceReducerModule as {
  reduceSurface(input: {
    spec: SurfaceSpec;
    hostShip: string;
    posts: { authorId: string; sequenceNum: number; blob: string }[];
  }): { status: string; state?: Record<string, unknown> };
};

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
/* preserveState conformance (D69)                                     */
/* ------------------------------------------------------------------ */

/**
 * **This is not a two-implementation conformance suite, because there is only
 * one implementation.** `surface-preview.ts` imports `reduceSurface` from
 * `@tloncorp/api/client/surface/reducer` and folds with it; there is no second
 * fold in the CLI to hold against the client's. A suite that ran the same
 * fixtures through `foldPopulatedState` and through `reduceSurface` and
 * asserted the two agreed would be asserting that a function equals itself —
 * green forever, including on the day somebody replaces the import with a
 * hand-rolled fold that gets `preserveState` wrong.
 *
 * So the honest test is the one that fails IF PREVIEW EVER FORKS. Three
 * assertions, each with a different fulcrum:
 *
 *  1. **the import** — the renderer reads the shared reducer's module. Fulcrum:
 *     the import statement. Delete it, or point it at a local copy, and this
 *     fails.
 *  2. **the migration gate is the reducer's** — preview's populated state for a
 *     preserving spec exists only because the stand-in snapshot satisfies the
 *     reducer's own §4.4/§6 rules. Fulcrum: the stand-in's author and
 *     revision. Break either and the reducer answers `migration-pending`,
 *     which is what preview would have to report rather than a state.
 *  3. **D69's divergence, as a checked statement** — preview's preserving fold
 *     is the NEW `initialState`, where production carries the OLD state. The
 *     capture is knowingly optimistic, and this pins that the optimism is the
 *     documented one and not a bug that drifted in.
 */
describe('preview folds with the client reducer, not a copy of it', () => {
  const rendererSource = readFileSync(
    join(process.cwd(), 'scripts', 'surface-preview.ts'),
    'utf8'
  );

  /**
   * Whitespace-collapsed and quote-normalized: the formatter rewraps these
   * declarations and rewrites their quotes as the file grows, and a pin that
   * broke on either would be a pin people learn to edit rather than read.
   */
  const flat = rendererSource.replace(/\s+/g, ' ').replace(/"/g, "'");

  it('imports the shared reducer rather than defining a fold', () => {
    expect(flat).toContain(
      "import * as surfaceReducerModule from '@tloncorp/api/client/surface/reducer'"
    );
    expect(flat).toContain('const { reduceSurface } = surfaceReducerModule');
    // and calls it — an import nothing uses is the same as no import
    expect(flat).toContain(
      'reduceSurface({ spec, hostShip: PREVIEW_HOST_SHIP, posts })'
    );
  });

  /**
   * The stand-in snapshot is a real `surface-snapshot` entry subject to every
   * rule the reducer applies to one. Each mutation below is a rule: authored
   * by a non-host, tagged at the wrong revision, or absent entirely. All three
   * must produce `migration-pending` from the reducer — which is what proves
   * preview's populated state is the reducer accepting a valid snapshot, and
   * not preview waving the migration gate past.
   */
  it('gets its preserving state from the reducer accepting the stand-in, not from bypassing it', () => {
    const spec = { ...pollSpec(), preserveState: true };
    const actionIds = Object.keys(spec.actions);
    const invokes = actionIds.map((actionId, index) => ({
      authorId: PREVIEW_ACTORS[index % PREVIEW_ACTORS.length],
      sequenceNum: index + 1,
      blob: JSON.stringify([
        {
          type: 'surface-event',
          version: 1,
          surfaceId: spec.surfaceId,
          specRevision: spec.specRevision,
          mode: 'invoke',
          actionId,
        },
      ]),
    }));
    const snapshot = (overrides: Record<string, unknown>) => ({
      authorId: PREVIEW_HOST_SHIP,
      sequenceNum: 0,
      blob: JSON.stringify([
        {
          type: 'surface-snapshot',
          version: 1,
          surfaceId: spec.surfaceId,
          specRevision: spec.specRevision,
          upToSequenceNum: 0,
          state: spec.initialState,
        },
      ]),
      ...overrides,
    });

    // no snapshot at all
    expect(
      reduceSurface({
        spec,
        hostShip: PREVIEW_HOST_SHIP,
        posts: invokes,
      }).status
    ).toBe('migration-pending');

    // authored by someone who is not the host
    expect(
      reduceSurface({
        spec,
        hostShip: PREVIEW_HOST_SHIP,
        posts: [snapshot({ authorId: '~ten' }), ...invokes],
      }).status
    ).toBe('migration-pending');

    // tagged at a revision that is not this one
    expect(
      reduceSurface({
        spec,
        hostShip: PREVIEW_HOST_SHIP,
        posts: [
          {
            authorId: PREVIEW_HOST_SHIP,
            sequenceNum: 0,
            blob: JSON.stringify([
              {
                type: 'surface-snapshot',
                version: 1,
                surfaceId: spec.surfaceId,
                specRevision: spec.specRevision + 1,
                upToSequenceNum: 0,
                state: spec.initialState,
              },
            ]),
          },
          ...invokes,
        ],
      }).status
    ).toBe('migration-pending');

    // and with the stand-in as preview actually posts it, a state
    expect(
      reduceSurface({
        spec,
        hostShip: PREVIEW_HOST_SHIP,
        posts: [snapshot({}), ...invokes],
      }).status
    ).toBe('reduced');
    expect(foldPopulatedState(spec).problem).toBeUndefined();
  });

  /**
   * D69, as an assertion rather than a paragraph.
   *
   * `surface publish --preserve-state` folds the channel's history against the
   * OLD spec and snapshots that, so the new `initialState` is dead on arrival
   * in production. Preview cannot see a channel, so it stands in a snapshot of
   * the NEW `initialState` — and the populated capture of a preserving
   * revision is therefore knowingly optimistic. The two states below are what
   * that costs: same spec, one carried state, one fresh one, and they are not
   * the same screen.
   */
  it('previews a preserving revision from the new initialState, which production discards', () => {
    const base = pollSpec();
    const spec = {
      ...base,
      preserveState: true,
      initialState: { ...base.initialState, votes: {} },
    } as SurfaceSpec;

    // what production carries: the state the channel already had
    const carried = { votes: { '~sampel-palnet': 'tacos' } };
    const production = reduceSurface({
      spec,
      hostShip: PREVIEW_HOST_SHIP,
      posts: [
        {
          authorId: PREVIEW_HOST_SHIP,
          sequenceNum: 0,
          blob: JSON.stringify([
            {
              type: 'surface-snapshot',
              version: 1,
              surfaceId: spec.surfaceId,
              specRevision: spec.specRevision,
              upToSequenceNum: 0,
              state: carried,
            },
          ]),
        },
      ],
    });

    // what preview shows: the new initialState, folded
    const previewed = foldPopulatedState(spec, { rounds: 1 });

    expect(production.status).toBe('reduced');
    expect(
      (production as { state: Record<string, unknown> }).state.votes
    ).toEqual(carried.votes);
    expect(previewed.state.votes).not.toEqual(carried.votes);
  });
});

/* ------------------------------------------------------------------ */
/* host ops (D70)                                                      */
/* ------------------------------------------------------------------ */

describe('foldPopulatedState with host ops', () => {
  /** A spec whose chart-shaped half only a host event can ever write. */
  function rolloverSpec(): SurfaceSpec {
    const base = pollSpec();
    return {
      ...base,
      initialState: { ...base.initialState, history: {}, today: {} },
    } as SurfaceSpec;
  }

  const archive = {
    ops: [{ op: 'set', path: '/history/2025-01-06', value: { done: 3 } }],
    at: 'before' as const,
    note: 'a finished session',
  };

  it('folds host events the reducer accepts, and reports them', () => {
    const folded = foldPopulatedState(rolloverSpec(), {
      hostOps: { entries: [archive], source: 'host-ops.json' },
    });
    expect(folded.problem).toBeUndefined();
    expect(folded.state.history).toEqual({ '2025-01-06': { done: 3 } });
    expect(folded.hostOps).toEqual([
      { at: 'before', opCount: 1, note: 'a finished session' },
    ]);
  });

  /**
   * The ordering is the whole reason `at` exists. `/history` is written by the
   * host and `votes` by the members; folding the archive `before` leaves both
   * populated in one capture, and folding a clearing op `after` shows the
   * post-rollover half. A file that could only say "after" would archive and
   * clear the very state the actions just produced.
   */
  it('folds before-entries ahead of the invokes and after-entries behind them', () => {
    const clear = {
      ops: [{ op: 'set', path: '/votes', value: {} }],
      at: 'after' as const,
    };
    const both = foldPopulatedState(rolloverSpec(), {
      hostOps: { entries: [archive, clear], source: 'host-ops.json' },
    });
    // the `after` op ran last, so it wins over everything the invokes wrote
    expect(both.state.votes).toEqual({});
    expect(both.state.history).toEqual({ '2025-01-06': { done: 3 } });

    const beforeOnly = foldPopulatedState(rolloverSpec(), {
      hostOps: { entries: [{ ...clear, at: 'before' as const }], source: 'x' },
    });
    // the same op ahead of the invokes is overwritten by them
    expect(Object.keys(beforeOnly.state.votes as object)).not.toHaveLength(0);
  });

  /**
   * A display-only app (`memberInteraction.mode: 'none'`) has no actions at
   * all, so host ops are the ONLY thing that can ever populate its capture.
   * Before D70 this reported "nothing can populate it" and rendered the empty
   * state twice.
   */
  it('populates a spec with no declared actions at all', () => {
    const spec = { ...rolloverSpec(), actions: {} } as SurfaceSpec;
    const folded = foldPopulatedState(spec, {
      hostOps: { entries: [archive], source: 'host-ops.json' },
    });
    expect(folded.problem).toBeUndefined();
    expect(folded.state.history).toEqual({ '2025-01-06': { done: 3 } });
    expect(folded.unchanged).toBe(false);
  });

  it('still reports a spec with neither actions nor host ops', () => {
    const folded = foldPopulatedState({
      ...pollSpec(),
      actions: {},
    } as SurfaceSpec);
    expect(folded.problem).toContain('nothing can populate it');
  });

  /**
   * The reducer aborts an entry at its first refused op (§7) and folds on, so
   * an unfoldable host op would otherwise produce a capture that looks exactly
   * like a clean one. Reported instead — a partly applied state must never
   * render the same as a whole one.
   */
  it('reports an entry the reducer aborted part-way', () => {
    const folded = foldPopulatedState(rolloverSpec(), {
      hostOps: {
        entries: [
          {
            ops: [
              { op: 'set', path: '/history/a', value: 1 },
              // a path missing its leading `/` — a grammar refusal, the
              // reducer's own worked example of an entry that aborts
              { op: 'set', path: 'history/mid', value: 2 },
              { op: 'set', path: '/history/b', value: 3 },
            ],
            at: 'before',
          },
        ],
        source: 'host-ops.json',
      },
    });
    expect(folded.abortedSequenceNums).not.toHaveLength(0);
    // the prefix landed, the rest did not — which is what "partly applied" is
    expect((folded.state.history as Record<string, unknown>).a).toBe(1);
    expect((folded.state.history as Record<string, unknown>).b).toBeUndefined();
  });

  /**
   * `parsePostBlob` degrades an entry that fails its schema to
   * `{ type: 'unknown' }` and the reducer walks straight past it — correct for
   * hostile channel content, and exactly wrong for a file the author just
   * wrote, because the capture would come back looking like one where the ops
   * were fine and simply did nothing.
   */
  it('refuses a host event the reducer would silently skip', () => {
    expect(() =>
      foldPopulatedState(rolloverSpec(), {
        hostOps: {
          entries: [{ ops: [{ op: 'nope', path: '/history' }], at: 'after' }],
          source: 'host-ops.json',
        },
      })
    ).toThrow(/not a host event the reducer would fold/);
  });
});

/* ------------------------------------------------------------------ */
/* the destructive-action hole                                         */
/* ------------------------------------------------------------------ */

/**
 * Actions fold in declaration order against a rotating crew, so whichever
 * action is declared last lands last on a determinate actor. When that action
 * is destructive, that member is erased from the state every populated cell
 * renders — a real member-shaped hole in the screenshots for a reason that has
 * nothing to do with the app. A template author hit this and worked around it
 * by declaring the reset first, which is a coping strategy against tool
 * behaviour rather than a property of good specs.
 */
describe('foldPopulatedState and destructive actions', () => {
  /** log-a, log-b, then a reset — the shape that produced the hole. */
  function resetLastSpec(): SurfaceSpec {
    const base = pollSpec();
    return {
      ...base,
      initialState: { ...base.initialState, entries: {} },
      actions: {
        'log-a': { ops: [{ op: 'set', path: '/entries/$actor', value: 'a' }] },
        'log-b': { ops: [{ op: 'set', path: '/entries/$actor', value: 'b' }] },
        'clear-mine': { ops: [{ op: 'del', path: '/entries/$actor' }] },
      },
    } as unknown as SurfaceSpec;
  }

  it('leaves no actor missing from the populated state', () => {
    const folded = foldPopulatedState(resetLastSpec());
    expect(folded.restoredAfterDestructive).toBe(true);
    expect(Object.keys(folded.state.entries as object).sort()).toEqual(
      [...PREVIEW_ACTORS].sort()
    );
  });

  /**
   * The control for the line above: without the restore pass, the fold DOES
   * erase a member. Reconstructed here by folding only the rounds — same
   * reducer, same rotation, same posts, minus the pass — so the assertion is
   * measuring the pass and not the fixture.
   */
  it('would erase one without the restore pass', () => {
    const spec = resetLastSpec();
    const actionIds = Object.keys(spec.actions);
    const posts: { authorId: string; sequenceNum: number; blob: string }[] = [];
    let sequenceNum = 1;
    for (let round = 0; round < 2; round++) {
      actionIds.forEach((actionId, index) => {
        posts.push({
          authorId: PREVIEW_ACTORS[(index + round) % PREVIEW_ACTORS.length],
          sequenceNum: sequenceNum++,
          blob: JSON.stringify([
            {
              type: 'surface-event',
              version: 1,
              surfaceId: spec.surfaceId,
              specRevision: spec.specRevision,
              mode: 'invoke',
              actionId,
            },
          ]),
        });
      });
    }
    const reduction = reduceSurface({
      spec,
      hostShip: PREVIEW_HOST_SHIP,
      posts,
    });
    expect(reduction.status).toBe('reduced');
    const entries = (reduction.state as Record<string, unknown>)
      .entries as object;
    expect(Object.keys(entries).length).toBeLessThan(PREVIEW_ACTORS.length);
  });

  it('does not run the pass for a spec with no destructive action', () => {
    const folded = foldPopulatedState(pollSpec());
    expect(folded.restoredAfterDestructive).toBe(false);
    // and the invoke count is exactly what it was before the pass existed
    expect(folded.invokes).toHaveLength(4);
  });

  /**
   * A spec whose every action is a `del` has nothing to restore WITH, so the
   * pass must not run and must not claim to have. The populated cell is
   * legitimately empty there, and saying otherwise would be worse than the
   * hole.
   */
  it('does not run the pass when every action is destructive', () => {
    const base = resetLastSpec();
    const folded = foldPopulatedState({
      ...base,
      actions: { 'clear-mine': base.actions['clear-mine'] },
    } as SurfaceSpec);
    expect(folded.restoredAfterDestructive).toBe(false);
  });
});

describe('parseHostOps', () => {
  it('accepts a list of entries and defaults placement to after', () => {
    const parsed = parseHostOps(
      [{ ops: [{ op: 'del', path: '/today' }] }],
      'host-ops.json'
    );
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].at).toBe('after');
    expect(parsed.source).toBe('host-ops.json');
  });

  it('refuses shapes it cannot fold, naming where', () => {
    expect(() => parseHostOps({ ops: [] }, 'f.json')).toThrow(
      /must hold a JSON array/
    );
    expect(() => parseHostOps([null], 'f.json')).toThrow(
      /f\.json\[0\] is not a host event object/
    );
    expect(() => parseHostOps([{}], 'f.json')).toThrow(/f\.json\[0\]\.ops/);
    expect(() => parseHostOps([{ ops: [], at: 'later' }], 'f.json')).toThrow(
      /must be "before" or "after"/
    );
    expect(() => parseHostOps([{ ops: [], note: 7 }], 'f.json')).toThrow(
      /note must be a string/
    );
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

  /**
   * `--state`: the twelve cells become "the app on this state" and "that, with
   * everything folded through it". The manifest says which happened, for the
   * same reason `stateSource` exists on the preflight witness — a capture of a
   * substituted state must never be indistinguishable from a capture of the
   * spec's own starting point.
   */
  it('renders a supplied state in place of initialState, and says so', async () => {
    const { launcher, pages } = fakeLauncher();
    const outcome = await renderSurfacePreview({
      bundleSha256: '0'.repeat(64),
      bundleSource: pollBundle(),
      spec: pollSpec(),
      outDir: outDir(),
      stateOverride: { votes: { '~sampel-palnet': 'tacos' } },
      launcher,
    });
    expect(outcome.manifest.stateSource).toBe('override');
    const init = JSON.parse(pages[0].mounted!.init as string);
    expect(init.state).toEqual({ votes: { '~sampel-palnet': 'tacos' } });
    // and the fold ran on top of it rather than on the spec's own start
    expect(Object.keys(outcome.populated.state.votes as object)).toContain(
      '~sampel-palnet'
    );
  });

  it('reports the spec’s own starting point when no state is supplied', async () => {
    const { launcher } = fakeLauncher();
    const outcome = await renderSurfacePreview({
      bundleSha256: '0'.repeat(64),
      bundleSource: pollBundle(),
      spec: pollSpec(),
      outDir: outDir(),
      launcher,
    });
    expect(outcome.manifest.stateSource).toBe('spec-initial-state');
  });

  /**
   * The fixed clock reaches the bridge, and reaches the manifest. Both halves
   * matter: the first is what makes a capture reproducible, the second is what
   * lets a reviewer check "14 days left" against the instant it was taken at.
   */
  it('injects the fixed host clock into every init, and records it', async () => {
    const { launcher, pages } = fakeLauncher();
    const outcome = await renderSurfacePreview({
      bundleSha256: '0'.repeat(64),
      bundleSource: pollBundle(),
      spec: pollSpec(),
      outDir: outDir(),
      launcher,
    });
    expect(outcome.manifest.now).toBe(PREVIEW_FIXED_NOW);
    for (const page of pages) {
      expect(JSON.parse(page.mounted!.init as string).now).toBe(
        PREVIEW_FIXED_NOW
      );
    }
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

/**
 * One preview run, in its own `bun` process, reporting the manifest it wrote
 * and a sha256 per captured cell.
 *
 * **Every browser test in this file goes through here, and that is not a style
 * choice.** In-process Playwright and `Bun.spawn` do not survive each other in
 * one process: once a process has driven a browser AND spawned a subprocess,
 * a later in-process browser session wedges part-way through the twelve cells
 * inside `page.close()` — a protocol call Playwright puts no timeout on — and
 * the test dies on its own deadline with nothing to read.
 *
 * Measured rather than taken on report. Filtered to the three tests that used
 * to drive a browser in-process, this file passes; add the determinism
 * control's four subprocesses back and it hangs, at a different cell each
 * time. CI saw it as a 120s timeout on a head whose only diff from a green one
 * was a JSON fixture and a report.
 *
 * The determinism control needs separate processes for its own reasons (see
 * below), so spawning for ALL of them removes the interaction rather than
 * ordering around it — a new browser test added to the bottom of the file
 * cannot reintroduce it. `surface-templates.test.ts` renders every shipped
 * template the same way.
 *
 * The runner is written to a temp file rather than passed with `bun -e` so the
 * source is on disk if a failure has to be diagnosed, and it imports the
 * renderer by absolute path so it resolves from anywhere.
 */
async function previewInSubprocess(request: {
  bundleSource: string;
  bundleSha256: string;
  spec: unknown;
  deviceScaleFactor?: number;
}): Promise<{
  manifest: PreviewManifest;
  /** sha256 of each captured PNG, keyed by cell id */
  digests: Record<string, string>;
  outDir: string;
}> {
  const dir = outDir();
  const bundlePath = join(dir, 'app.js');
  const runnerPath = join(dir, 'run-preview.ts');
  writeFileSync(bundlePath, request.bundleSource);
  writeFileSync(
    runnerPath,
    [
      `import { createHash } from 'node:crypto';`,
      `import { readFileSync } from 'node:fs';`,
      `import { cellId, renderSurfacePreview } from ${JSON.stringify(
        join(process.cwd(), 'scripts', 'surface-preview.ts')
      )};`,
      `const outcome = await renderSurfacePreview({`,
      `  bundleSource: readFileSync(${JSON.stringify(bundlePath)}, 'utf8'),`,
      `  bundleSha256: ${JSON.stringify(request.bundleSha256)},`,
      `  spec: ${JSON.stringify(request.spec)},`,
      `  outDir: ${JSON.stringify(dir)},`,
      ...(request.deviceScaleFactor === undefined
        ? []
        : [`  deviceScaleFactor: ${request.deviceScaleFactor},`]),
      `});`,
      `const digests = {};`,
      `for (const shot of outcome.shots) {`,
      `  digests[cellId(shot.cell)] = createHash('sha256')`,
      `    .update(readFileSync(shot.path))`,
      `    .digest('hex');`,
      `}`,
      `process.stdout.write(`,
      `  JSON.stringify({ manifest: outcome.manifest, digests })`,
      `);`,
      ``,
    ].join('\n')
  );
  const proc = Bun.spawn(['bun', 'run', runnerPath], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`preview subprocess exited ${code}: ${stderr}`);
  }
  const reported = JSON.parse(stdout) as {
    manifest: PreviewManifest;
    digests: Record<string, string>;
  };
  return { ...reported, outDir: dir };
}

describe('headless capture', () => {
  browserTest(
    'renders the poll fixture through real chromium',
    async () => {
      const { manifest } = await previewInSubprocess({
        bundleSource: pollBundle(),
        bundleSha256: '0'.repeat(64),
        spec: pollSpec(),
      });
      expect(manifest.shellErrors).toEqual([]);
      // a loop over an empty list would pass while capturing nothing
      expect(manifest.shots).toHaveLength(12);
      for (const shot of manifest.shots) {
        expect(existsSync(shot.path)).toBe(true);
        // a PNG, not a zero-byte placeholder
        expect(readFileSync(shot.path).byteLength).toBeGreaterThan(1000);
      }
    },
    120_000
  );

  /* ---------------------------------------------------------------- */
  /* the determinism control                                           */
  /* ---------------------------------------------------------------- */

  /**
   * **The control, with both arms, in separate processes.**
   *
   * The claim: a host-supplied `now` makes a clock-dependent app's captures
   * reproducible across preview RUNS. Both arms run here, over the same twelve
   * cells, separated by more than a second of real wall time:
   *
   *  - **injected** (`CLOCK_FROM_CONTEXT_BUNDLE`) — renders `context.now`,
   *    which preview pins to `PREVIEW_FIXED_NOW`. Two runs must produce
   *    byte-identical PNGs.
   *  - **ambient** (`CLOCK_FROM_DATE_BUNDLE`) — renders `Date.now()` inside
   *    the bundle, the pattern PARADIGM §3 bans and the only way an app could
   *    show the time before `context.now` existed. Two runs must produce
   *    DIFFERENT PNGs.
   *
   * The ambient arm is what makes this a control rather than an assertion:
   * without it, "the captures matched" is equally consistent with a fixture
   * that never rendered the clock, a screenshot pipeline that writes the same
   * bytes regardless, and a comparison that always returns true.
   *
   * **Each run is its own process, and that is load-bearing.** The first
   * version of this test called `renderSurfacePreview` four times in one
   * process and PASSED with `PREVIEW_FIXED_NOW` mutated to `Date.now()` —
   * because a module-level constant is evaluated once per process, so both
   * in-process runs read the same wall clock and the mutation was invisible.
   * A control that cannot see that mutation is not measuring what it claims.
   * Separate processes are also what a "preview run" actually is.
   */
  const WALL_CLOCK_GAP_MS = 1_100;

  /** The sanctioned shape: time arrives as an argument. */
  const CLOCK_FROM_CONTEXT_BUNDLE = `(function () {
    const { html, primitives } = surface;
    const { Card, Stat } = primitives;
    surface.register({
      render(state, context) {
        const seconds = context.now === null
          ? 'none'
          : String(Math.floor(context.now / 1000));
        return html\`<\${Card} title="Clock"><\${Stat} value=\${seconds} label="seconds" /><//>\`;
      },
    });
  })();`;

  /** The banned shape, here ONLY as the control's negative arm. */
  const CLOCK_FROM_DATE_BUNDLE = `(function () {
    const { html, primitives } = surface;
    const { Card, Stat } = primitives;
    surface.register({
      render(state) {
        const seconds = String(Math.floor(Date.now() / 1000));
        return html\`<\${Card} title="Clock"><\${Stat} value=\${seconds} label="seconds" /><//>\`;
      },
    });
  })();`;

  const CLOCK_SPEC = {
    version: 1,
    surfaceId: 'srf-clock-control',
    specRevision: 1,
    title: 'Clock',
    bundle: {
      assetRef: 'fixture://clock/app.js',
      sha256: '0'.repeat(64),
      size: 1024,
      shellVersion: 1,
    },
    initialState: { touched: {} },
    actions: {
      tick: { ops: [{ op: 'set', path: '/touched/$actor', value: true }] },
    },
  };

  /**
   * One run of the clock fixture, reporting a sha256 per cell.
   *
   * A blank capture would hash identically on both arms and make the control
   * vacuous, so a run that reported a shell error fails here rather than
   * contributing digests.
   */
  async function captureClock(
    bundleSource: string
  ): Promise<Record<string, string>> {
    const { manifest, digests } = await previewInSubprocess({
      bundleSource,
      bundleSha256: '0'.repeat(64),
      spec: CLOCK_SPEC,
      deviceScaleFactor: 1,
    });
    expect(manifest.shellErrors).toEqual([]);
    return digests;
  }

  browserTest(
    'two runs at different wall times: identical under injected now, different without it',
    async () => {
      // arm 1 — the injected clock
      const injectedFirst = await captureClock(CLOCK_FROM_CONTEXT_BUNDLE);
      await new Promise((resolve) => setTimeout(resolve, WALL_CLOCK_GAP_MS));
      const injectedSecond = await captureClock(CLOCK_FROM_CONTEXT_BUNDLE);

      // arm 2 — the ambient clock, the same two runs
      const ambientFirst = await captureClock(CLOCK_FROM_DATE_BUNDLE);
      await new Promise((resolve) => setTimeout(resolve, WALL_CLOCK_GAP_MS));
      const ambientSecond = await captureClock(CLOCK_FROM_DATE_BUNDLE);

      const cells = Object.keys(injectedFirst).sort();
      expect(cells).toHaveLength(12);
      expect(Object.keys(ambientFirst).sort()).toEqual(cells);

      for (const cell of cells) {
        expect(injectedSecond[cell], `injected ${cell}`).toBe(
          injectedFirst[cell]
        );
      }

      // and the arm that has to disagree, or the one above proves nothing
      const changed = cells.filter(
        (cell) => ambientSecond[cell] !== ambientFirst[cell]
      );
      expect(changed, 'ambient captures must differ across runs').toEqual(
        cells
      );
    },
    600_000
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

/* ------------------------------------------------------------------ */
/* the populated captures are synthetic, and the sheet has to say so   */
/* ------------------------------------------------------------------ */

/** One shipped template's files, read from the skill tree they ship in. */
function template(name: string): { spec: unknown; state: unknown } {
  const dir = join(process.cwd(), 'skills', 'surfaces', 'templates', name);
  return {
    spec: JSON.parse(readFileSync(join(dir, 'spec.json'), 'utf8')),
    state: JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')),
  };
}

/** The `populated` line preview stamps on check 5, off a real render. */
/**
 * Keyed off the real signature rather than restated, so a change to
 * `PreviewRequest` cannot leave this helper quietly incompatible.
 */
type PreviewStateOverride = Parameters<
  typeof renderSurfacePreview
>[0]['stateOverride'];

async function populatedLine(request: {
  spec: unknown;
  stateOverride?: PreviewStateOverride;
}): Promise<{ line: string; state: Record<string, unknown> }> {
  const { launcher } = fakeLauncher();
  const outcome = await renderSurfacePreview({
    bundleSource: 'globalThis.render = () => ({ type: "Screen", props: {} });',
    bundleSha256: '7'.repeat(64),
    spec: request.spec,
    outDir: outDir(),
    launcher,
    ...(request.stateOverride === undefined
      ? {}
      : { stateOverride: request.stateOverride }),
  });
  const sheet = JSON.parse(readFileSync(outcome.rubricTemplatePath, 'utf8'));
  return {
    line: sheet.checks['populated-scannable'].populated as string,
    state: outcome.populated.state as Record<string, unknown>,
  };
}

describe('renderSurfacePreview — the sheet says what the populated cells ARE', () => {
  /**
   * The failing control, and it is the case that was actually misread.
   *
   * `surface preview potluck/app.js potluck/spec.json --state
   * potluck/state.json` renders an `initial` cell reading "Mains 2 of 4, Sides
   * 1 of 4, Drinks 1 of 3, Dessert 1 of 3" over "9 more wanted" — a sheet that
   * reconciles — and a `populated` cell reading "Mains 0 of 4, Drinks 0 of 3,
   * **Dessert 4 of 3**" over "10 more wanted". The fold hands all five
   * course actions to each of ~zod, ~ten and ~palfun-foslup, so all three end
   * on the last one declared and overwrite the courses the supplied board had
   * them down for. Nothing in the twelve images says any of that, and a careful
   * reader scored those numbers as the app's and filed the template as broken.
   *
   * Both halves are asserted here: the board really is over capacity (so the
   * test fails if someone decides the citation is no longer needed because the
   * fold "got better"), and the sheet really does say where it came from.
   */
  it('stamps the potluck fold that reads "Dessert 4 of 3" as a fold over a supplied board', async () => {
    const potluck = template('potluck');
    const { line, state } = await populatedLine({
      spec: potluck.spec,
      stateOverride: potluck.state as PreviewStateOverride,
    });

    // The board itself, first: four members on a course the sheet wants three
    // of, and every one of the synthetic crew moved off what they were down for.
    const bringing = state.bringing as Record<string, { course?: string }>;
    const dessert = Object.values(bringing).filter(
      (entry) => entry.course === 'dessert'
    );
    const want = (
      potluck.state as { courses: Record<string, { want: number }> }
    ).courses.dessert.want;
    expect(want).toBe(3);
    expect(dessert.length).toBeGreaterThan(want);
    for (const actor of PREVIEW_ACTORS) {
      expect(bringing[actor].course).toBe('dessert');
    }

    // And the sheet, which is where the scorer meets it.
    expect(line.startsWith('folded onto a supplied state:')).toBe(true);
    expect(line).toContain('all 7 declared action(s)');
    expect(line).toContain('~zod, ~ten, ~palfun-foslup');
    expect(line).toContain('had their entry overwritten');
    expect(line).toContain('No group produced this board');
    expect(line).toContain('no count here is held to any limit');
  });

  /**
   * The positive control, and a genuinely separate case rather than the same
   * app with a flag flipped.
   *
   * The lunch poll's fold is already plausible — three voters, one vote each,
   * one for each option — because its three actions all write `/votes/$actor`
   * and the rotation hands a different one to each ship. Two things must hold
   * for it: the board is not degraded (this change renders nothing
   * differently), and the citation does not describe it as something it is not.
   * The line is provenance, not a verdict: it never claims a board is
   * implausible, because nothing here can tell.
   */
  it('leaves an already-plausible fold alone, and labels it as provenance rather than a defect', async () => {
    const poll = template('poll');
    const { line, state } = await populatedLine({ spec: poll.spec });

    // Not degraded: still one vote each, still three different options.
    const votes = state.votes as Record<string, string>;
    expect(votes).toEqual({
      '~zod': 'salad',
      '~ten': 'pizza',
      '~palfun-foslup': 'tacos',
    });
    expect(new Set(Object.values(votes)).size).toBe(3);

    // Not mislabelled: this is the app's own starting point with a fold on top,
    // and the line says exactly that — no supplied board, no overwriting, and
    // no claim that anything here is wrong.
    expect(line.startsWith('folded:')).toBe(true);
    expect(line).toContain('6 invoke(s) of all 3 declared action(s)');
    expect(line).not.toContain('supplied state');
    expect(line).not.toContain('overwritten');
    expect(line).not.toContain('restore pass');
    // The provenance still lands: a plausible board is still a synthetic one,
    // and the scorer is told so on the check whose subject it is.
    expect(line).toContain('No group produced this board');
    expect(line).toContain('Score the LAYOUT');
  });

  it('says a fold that could not run at all differently again', async () => {
    // The countdown ships no actions — it moves by host event and nothing else
    // — so there is no fold, and the populated captures are the initial ones.
    // "Nothing to fold" reading like "here is the board the app produces" is
    // the same collapse one level up.
    const { line } = await populatedLine({ spec: template('countdown').spec });
    expect(line.startsWith('not folded:')).toBe(true);
    expect(line).toContain('the spec declares no actions');
  });
});

describe('headless capture — the defect pass against a real browser', () => {
  browserTest(
    'finds the crowding, the overflow and the jargon in a bad bundle',
    async () => {
      const { manifest } = await previewInSubprocess({
        bundleSource: DEFECTIVE_BUNDLE,
        bundleSha256: '1'.repeat(64),
        spec: defectiveSpec(),
      });
      // The probe reached the sandbox at all — an opaque-origin srcdoc frame
      // the host page cannot touch. If this ever regresses, every cell goes
      // unprobed and the pass reports a clean bill of health.
      expect(manifest.unprobedCells).toEqual([]);
      const messages = manifest.defects.map(
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
      const { manifest } = await previewInSubprocess({
        bundleSource: pollBundle(),
        bundleSha256: '2'.repeat(64),
        spec: pollSpec(),
      });
      expect(manifest.unprobedCells).toEqual([]);
      expect(manifest.defects).toEqual([]);
    },
    120_000
  );
});
