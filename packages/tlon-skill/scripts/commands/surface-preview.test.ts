import { describe, expect, it } from 'bun:test';

import {
  PreviewError,
  PreviewUnavailableError,
  type PreviewManifest,
  type PreviewOutcome,
  type PreviewRequest,
} from '../surface-preview';
import {
  SURFACE_PREVIEW_HELP,
  type SurfacePreviewDeps,
  parseSurfacePreviewArgs,
  run,
  runSurfacePreview,
} from './surface-preview';

function manifest(overrides: Partial<PreviewManifest> = {}): PreviewManifest {
  return {
    surfaceId: 'srf-poll',
    specRevision: 2,
    title: 'Lunch poll',
    shellVersion: 1,
    actions: ['vote-pizza', 'vote-tacos'],
    actors: ['~zod', '~ten', '~mug'],
    rubric: 'skills/surfaces/RUBRIC.md',
    populated: {
      invokes: [{ actionId: 'vote-pizza', actor: '~zod' }],
      unchanged: false,
    },
    shots: [
      {
        viewport: 'phone',
        theme: 'light',
        state: 'initial',
        width: 390,
        height: 844,
        path: '/out/phone-initial-light.png',
      },
      {
        viewport: 'desktop',
        theme: 'dark',
        state: 'populated',
        width: 1280,
        height: 900,
        path: '/out/desktop-populated-dark.png',
      },
    ],
    shellErrors: [],
    ...overrides,
  };
}

function makeDeps(
  options: {
    files?: Record<string, string>;
    render?: (request: PreviewRequest) => Promise<PreviewOutcome>;
  } = {}
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const requests: PreviewRequest[] = [];
  const files = options.files ?? {
    'app.js': 'surface.register({ render: () => null });',
    'spec.json': JSON.stringify({ surfaceId: 'srf-poll' }),
  };

  const deps: SurfacePreviewDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    readFile: (path) => {
      const contents = files[path];
      if (contents === undefined) {
        throw new Error('ENOENT: no such file');
      }
      return contents;
    },
    render:
      options.render ??
      (async (request) => {
        requests.push(request);
        return {
          manifest: manifest(),
          manifestPath: '/out/manifest.json',
          shots: [],
          populated: { state: {}, invokes: [], unchanged: false },
        };
      }),
  };

  return {
    deps,
    out: () => stdout.join(''),
    err: () => stderr.join(''),
    requests,
  };
}

describe('parseSurfacePreviewArgs', () => {
  it('takes the bundle and the spec positionally', () => {
    const parsed = parseSurfacePreviewArgs(['app.js', 'spec.json']);
    expect(parsed.bundle).toBe('app.js');
    expect(parsed.spec).toBe('spec.json');
    expect(parsed.includePopulated).toBe(true);
    expect(parsed.canInvoke).toBe(true);
  });

  it('reads the capture flags', () => {
    const parsed = parseSurfacePreviewArgs([
      'app.js',
      'spec.json',
      '--out',
      'shots',
      '--settle',
      '900',
      '--scale',
      '1',
      '--full-height',
      '3000',
      '--rounds',
      '4',
      '--no-populated',
      '--read-only',
      '--json',
    ]);
    expect(parsed).toMatchObject({
      outDir: 'shots',
      settleMs: 900,
      deviceScaleFactor: 1,
      fullHeight: 3000,
      foldRounds: 4,
      includePopulated: false,
      canInvoke: false,
      json: true,
    });
  });

  it('refuses a missing spec path', () => {
    expect(() => parseSurfacePreviewArgs(['app.js'])).toThrow(
      /bundle path and a spec path/
    );
  });

  it('refuses an unknown option', () => {
    expect(() =>
      parseSurfacePreviewArgs(['app.js', 'spec.json', '--wat'])
    ).toThrow(/unknown option --wat/);
  });

  it('refuses a non-numeric flag value', () => {
    expect(() =>
      parseSurfacePreviewArgs(['app.js', 'spec.json', '--scale', 'big'])
    ).toThrow(/--scale needs a non-negative number/);
  });
});

describe('surface preview', () => {
  it('prints help with no arguments', async () => {
    const { deps, out } = makeDeps();
    expect(await run([], deps)).toBe(0);
    expect(out()).toContain(SURFACE_PREVIEW_HELP);
  });

  it('reports phone cells before desktop ones', async () => {
    const { deps, out } = makeDeps();
    expect(await run(['app.js', 'spec.json'], deps)).toBe(0);
    const printed = out();
    expect(printed.indexOf('phone 390x844')).toBeGreaterThan(-1);
    expect(printed.indexOf('phone 390x844')).toBeLessThan(
      printed.indexOf('desktop 1280x900')
    );
    expect(printed).toContain('skills/surfaces/RUBRIC.md');
    expect(printed).toContain('manifest: /out/manifest.json');
  });

  it('passes the requested output directory through', async () => {
    const { deps, requests } = makeDeps();
    await run(['app.js', 'spec.json', '--out', 'shots'], deps);
    expect(requests[0].outDir).toBe('shots');
  });

  it('defaults the output directory predictably', async () => {
    const { deps, requests } = makeDeps();
    await run(['app.js', 'spec.json'], deps);
    expect(requests[0].outDir).toBe('surface-preview');
  });

  it('fails on an unreadable bundle', async () => {
    const { deps, err } = makeDeps({ files: {} });
    expect(await run(['app.js', 'spec.json'], deps)).toBe(1);
    expect(err()).toContain('could not read the bundle at app.js');
  });

  it('fails on a spec that is not JSON', async () => {
    const { deps, err } = makeDeps({
      files: { 'app.js': '', 'spec.json': '{oops' },
    });
    expect(await run(['app.js', 'spec.json'], deps)).toBe(1);
    expect(err()).toContain('spec.json is not valid JSON');
  });

  it('reports a spec the schema rejects as an error, not a crash', async () => {
    const { deps, err } = makeDeps({
      render: async () => {
        throw new PreviewError('spec is not a valid surface spec: version');
      },
    });
    expect(await run(['app.js', 'spec.json'], deps)).toBe(1);
    expect(err()).toContain('not a valid surface spec');
  });

  /**
   * The degraded path the provisioning note calls for: no Chromium means no
   * preview, said plainly, so the caller can fall back to publishing on
   * lint and fold alone.
   */
  it('explains a missing headless Chromium instead of stack-tracing', async () => {
    const { deps, err } = makeDeps({
      render: async () => {
        throw new PreviewUnavailableError(new Error('Cannot find module'));
      },
    });
    expect(await run(['app.js', 'spec.json'], deps)).toBe(1);
    expect(err()).toContain('headless Chromium is not available');
    expect(err()).toContain('lint and fold alone');
  });

  it('exits non-zero when the shell reported an error while capturing', async () => {
    const { deps, err } = makeDeps({
      render: async () => ({
        manifest: manifest({
          shellErrors: [
            {
              cell: 'phone-initial-light.png',
              phase: 'render',
              message: 'state.votes is undefined',
            },
          ],
        }),
        manifestPath: '/out/manifest.json',
        shots: [],
        populated: { state: {}, invokes: [], unchanged: false },
      }),
    });
    expect(await run(['app.js', 'spec.json'], deps)).toBe(1);
    expect(err()).toContain('state.votes is undefined');
    expect(err()).toContain('phone-initial-light.png');
  });

  it('says so when folding every action changed nothing', async () => {
    const { deps, out } = makeDeps({
      render: async () => ({
        manifest: manifest(),
        manifestPath: '/out/manifest.json',
        shots: [],
        populated: { state: {}, invokes: [], unchanged: true },
      }),
    });
    await run(['app.js', 'spec.json'], deps);
    expect(out()).toContain('changed nothing');
  });

  it('adapts the surface group’s dep bag', async () => {
    const stdout: string[] = [];
    const exit = await runSurfacePreview(['--help'], {
      stdout: (text) => stdout.push(text),
      stderr: () => {},
      readTextFile: () => '',
    });
    expect(exit).toBe(0);
    expect(stdout.join('')).toContain('tlon surface preview');
  });

  it('prints the manifest as JSON on --json', async () => {
    const { deps, out } = makeDeps();
    expect(await run(['app.js', 'spec.json', '--json'], deps)).toBe(0);
    expect(JSON.parse(out()).surfaceId).toBe('srf-poll');
  });
});
