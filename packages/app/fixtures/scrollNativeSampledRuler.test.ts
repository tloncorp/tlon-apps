import { describe, it, expect } from 'vitest';
import {
  adaptNativeScrollGeometry,
  adaptNativeEntryRuler,
} from './scrollNativeGeometry';
import {
  assessScrollPreconditions,
  assessScrollTrace,
} from './scrollStabilityTrace';
function fixture() {
  const frame = (x: number, y: number, width: number, height: number) => ({
    x,
    y,
    width,
    height,
  });
  const view = (identity: string, f: any, descendantOfScroll: boolean) => ({
    identity,
    frame: f,
    clipFrame: { ...f },
    windowIdentity: 'window',
    attached: true,
    effectiveAlpha: 1,
    hidden: false,
    translationOnly: true,
    descendantOfScroll,
  });
  const scope = 'chat/exact::2';
  const signature = { content: 'exact tail', reactions: '[]', replies: 0 };
  const metadata = JSON.stringify({
    version: 1,
    scope,
    key: 'tail',
    signature,
  });
  const inner = {
    ...view('inner', frame(8, 654.3333333333334, 386, 121.666015625), true),
    containingCellIdentity: 'cell',
    semanticValue: metadata,
  };
  const cell = {
    ...view('cell', frame(8, 654.3333333333334, 386, 121.3330078125), true),
    containingCellIdentity: 'cell',
    semanticValue: metadata,
  };
  const body = {
    id: 'scroll-surface-body',
    matches: 1,
    view: view('body', frame(68, 784, 322, 48), false),
  };
  const manifest = {
    id: 'scroll-surface-manifest',
    matches: 1,
    view: {
      ...view('manifest', frame(0, 0, 0, 0), false),
      semanticValue: JSON.stringify({
        version: 1,
        scope,
        surfaceIds: [body.id],
      }),
    },
  };
  const request = {
    requestId: 'native-1',
    rootId: 'root',
    scrollViewId: 'scroll',
    composerId: 'composer',
    rows: [{ key: 'tail', id: 'scroll-row-tail' }],
  };
  const raw: any = {
    version: 1,
    ...request,
    rowIds: request.rows.map((r) => r.id),
    clock: 'CACurrentMediaTime milliseconds',
    coordinateSpace: 'window-model-points',
    startedAt: 1000,
    finishedAt: 1001,
    status: 'ok',
    issues: [],
    visitedViews: 50,
    root: view('root', frame(0, 0, 402, 874), false),
    composer: view('composer', frame(0, 720, 402, 120), false),
    scroll: {
      view: view('scroll', frame(0, 203, 402, 671), true),
      hostIdentity: 'host',
      offset: { x: 0, y: 10487.333333333334 },
      bounds: frame(0, 10487.333333333334, 402, 671),
      contentSize: { width: 402, height: 11060.333333333334 },
      contentInset: { top: 0, bottom: 98, left: 0, right: 0 },
      adjustedContentInset: { top: 0, bottom: 98, left: 0, right: 0 },
      zoomScale: 1,
      tracking: false,
      dragging: false,
      decelerating: false,
    },
    rows: [{ id: 'scroll-row-tail', matches: 1, view: inner }],
    ruler: {
      version: 1,
      cells: [{ id: 'scroll-cell-tail', matches: 1, view: cell }],
      surfaces: [body],
      manifest,
    },
  };
  const bracket: any = {
    requestedAt: 200,
    receivedAt: 205,
    requiredKeys: ['tail'],
    populated: true,
    ruler: { version: 'indexed-cell-and-surfaces-v2', scope },
  };
  const assess = () => adaptNativeScrollGeometry(raw, request, bracket);
  const record = (result: any) =>
    result.snapshot.acquisition.nativeGeometry.ruler;
  const latest = (x = 177, width = 48) => {
    raw.ruler.surfaces.push({
      id: 'scroll-surface-latest',
      matches: 1,
      view: view('latest', frame(x, 728, width, 48), false),
    });
    manifest.view.semanticValue = JSON.stringify({
      version: 1,
      scope,
      surfaceIds: raw.ruler.surfaces.map((s: any) => s.id),
    });
  };
  return { raw, request, bracket, assess, record, latest, inner, cell };
}
const options = {
  requireHistory: false,
  requireInitialEnd: true,
  requireReadingAnchor: false,
  readingAnchorKey: 'tail',
  excludedAnchorKeys: [],
  initialTailKey: 'tail',
  allowEmptyEnd: false,
};
describe('future sampled native ruler v2 against real adapter/precondition functions', () => {
  it('default keeps the old full-wrapper geometry and v1 containment result', () => {
    const d = fixture();
    delete d.bracket.ruler;
    expect(d.assess().snapshot.viewportBottom).toBe(720);
    expect(
      adaptNativeEntryRuler(d.raw, d.bracket.scope ?? 'chat/exact::2').issues
    ).toContain('native-ruler-inner-cell-association-mismatch');
  });
  it('uses the same native reserved viewport rather than the wrapper', () => {
    const d = fixture();
    const r = d.assess();
    expect(r.issues).toEqual([]);
    expect(r.snapshot.viewportBottom).toBe(776);
    expect(r.snapshot.measurement).toEqual({ valid: true, durationMs: 5 });
    expect(assessScrollPreconditions(r.snapshot, options).established).toBe(
      true
    );
  });
  it('retains distinct indexed-cell and actual unclipped inner measurements without widening epsilon', () => {
    const d = fixture();
    const r = d.assess();
    expect(r.issues).toEqual([]);
    expect(d.record(r).cells[0]).toMatchObject({
      key: 'tail',
      frame: { height: 121.3330078125 },
    });
    expect(r.snapshot.rows[0].height).toBe(121.666015625);
  });
  it('true applied composer/inset growth still reduces usable viewport', () => {
    const d = fixture();
    d.raw.scroll.adjustedContentInset.bottom = 154;
    d.raw.scroll.contentInset.bottom = 154;
    const r = d.assess();
    expect(r.snapshot.viewportBottom).toBe(720);
    expect(assessScrollPreconditions(r.snapshot, options).established).toBe(
      false
    );
  });
  it('rejects wrong measured containing-cell identity despite identical frames/text', () => {
    const d = fixture();
    d.inner.containingCellIdentity = 'other-cell';
    expect(d.assess().issues).toContain(
      'native-ruler-inner-cell-association-mismatch'
    );
  });
  it('rejects wrong cell semantic scope', () => {
    const d = fixture();
    d.cell.semanticValue = d.cell.semanticValue.replace(
      'chat/exact::2',
      'chat/other::2'
    );
    expect(d.assess().issues).toContain('native-ruler-cell-revision-mismatch');
  });
  it('rejects wrong cell semantic revision', () => {
    const d = fixture();
    d.cell.semanticValue = d.cell.semanticValue.replace(
      'exact tail',
      'wrong tail'
    );
    expect(d.assess().issues).toContain('native-ruler-cell-revision-mismatch');
  });
  it('does not replace genuinely clipped inner content with its full bounds', () => {
    const d = fixture();
    d.inner.clipFrame.height = 70;
    expect(d.assess().issues).toContain(
      'native-row-clipping-disagrees-with-viewport'
    );
  });
  it('rejects hidden required inner content', () => {
    const d = fixture();
    d.inner.hidden = true;
    expect(d.assess().issues).toContain('hidden-required-native-row');
  });
  it('rejects exposed inner paired with unexposed cell', () => {
    const d = fixture();
    d.cell.hidden = true;
    expect(d.assess().issues).toContain(
      'native-ruler-inner-cell-association-mismatch'
    );
  });
  it('requires the same-walk surface manifest', () => {
    const d = fixture();
    delete d.raw.ruler.manifest;
    expect(d.assess().issues).toContain('invalid-native-ruler-manifest');
  });
  it('records partial-width obstruction and refuses an obscured initial tail', () => {
    const d = fixture();
    d.latest();
    const r = d.assess();
    expect(r.snapshot.viewportBottom).toBe(776);
    expect(d.record(r).obscuredKeys).toEqual(['tail']);
    expect(
      assessScrollPreconditions(r.snapshot, options).issues.map((i) => i.code)
    ).toContain('initial-tail-obscured');
  });
  it('a surface outside the actual row width does not cut the whole viewport', () => {
    const d = fixture();
    d.inner.frame.width = 120;
    d.inner.clipFrame.width = 120;
    d.cell.frame.width = 120;
    d.cell.clipFrame.width = 120;
    d.latest();
    const r = d.assess();
    expect(d.record(r).obscuredKeys).toEqual([]);
    expect(r.snapshot.viewportBottom).toBe(776);
    expect(assessScrollPreconditions(r.snapshot, options).established).toBe(
      true
    );
    expect(d.record(r).latestControlVisible).toBe(true);
  });
  it('records full surface rectangles and latest visibility independently', () => {
    const d = fixture();
    d.latest();
    const r = d.assess();
    expect(
      d.record(r).surfaces.find((s: any) => s.id === 'scroll-surface-latest')
    ).toMatchObject({ frame: { x: 177, y: 728, width: 48, height: 48 } });
    expect(d.record(r).latestControlVisible).toBe(true);
  });
  it('long JS bracket remains invalid and never becomes a v2 precondition pass', () => {
    const d = fixture();
    d.bracket.receivedAt = 240;
    const r = d.assess();
    expect(r.issues).toContain('invalid-native-js-bracket');
    expect(r.snapshot.measurement?.valid).toBe(false);
    expect(assessScrollPreconditions(r.snapshot, options).established).toBe(
      false
    );
  });
  it('post-acquisition ownership invalidation cannot be repaired by ruler geometry', () => {
    const d = fixture();
    const r = d.assess();
    r.snapshot.measurement!.valid = false;
    r.snapshot.acquisition!.nativeGeometry!.issues.push(
      'native-js-ownership-changed'
    );
    expect(assessScrollPreconditions(r.snapshot, options).established).toBe(
      false
    );
  });
  it.each([
    { version: 'unknown', scope: 'chat/exact::2' },
    { version: 'indexed-cell-and-surfaces-v2', scope: '' },
  ])('rejects an undeclared ruler contract %j', (contract) => {
    const d = fixture();
    d.bracket.ruler = contract;
    expect(d.assess().issues).toContain(
      'invalid-native-sampled-ruler-contract'
    );
  });
  it('requires requested reading content even when a cell marker still exists', () => {
    const d = fixture();
    d.raw.rows[0] = { id: 'scroll-row-tail', matches: 0 };
    expect(d.assess().issues).toContain('missing-required-native-row');
  });
});

describe('v2 obstruction does not disappear after setup', () => {
  const trace = (snapshot: any, extra: any) =>
    assessScrollTrace(
      [0, 100, 200].map((time) => ({ ...snapshot, time })),
      {
        action: {
          name: 'measured action',
          startedAt: 0,
          completedAt: 0,
          observed: true,
        },
        coverage: { startTime: 0, endTime: 200 },
        ...extra,
      }
    );
  it.each([
    ['anchor', { anchor: { key: 'tail', baselineY: 654.3333333333334 } }],
    ['tail', { bottom: { tailKey: 'tail' } }],
    [
      'target',
      { landing: { key: 'tail', alignment: 'bottom', settleStartTime: 0 } },
    ],
  ])(
    'rejects actual surface overlap of the required %s during valid samples',
    (label, extra) => {
      const d = fixture();
      d.latest();
      const result = trace(d.assess().snapshot, extra);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: `${label}-obscured`, kind: 'failure' })
      );
    }
  );
  it('invalid acquisition remains incomplete instead of certifying an obstruction failure', () => {
    const d = fixture();
    d.latest();
    d.bracket.receivedAt = 240;
    const r = trace(d.assess().snapshot, { bottom: { tailKey: 'tail' } });
    expect(r.verdict).toBe('INCOMPLETE');
    expect(r.issues.some((i) => i.kind === 'failure')).toBe(false);
  });
  it('requires versioned inner semantics, independently of matching cell semantics', () => {
    const d = fixture();
    d.inner.semanticValue = d.inner.semanticValue.replace(
      '"version":1',
      '"version":2'
    );
    expect(d.assess().issues).toContain('native-ruler-cell-revision-mismatch');
  });
  it('does not allow two missing signatures to agree vacuously', () => {
    const d = fixture();
    for (const view of [d.cell, d.inner]) {
      const meta = JSON.parse(view.semanticValue);
      delete meta.signature;
      view.semanticValue = JSON.stringify(meta);
    }
    expect(d.assess().issues).toContain('native-ruler-cell-revision-mismatch');
  });
});

it('v2 rejects partial horizontal clipping instead of treating any positive overlap as full exposure', () => {
  const d = fixture();
  d.inner.clipFrame.width = 120;
  expect(d.assess().issues).toContain(
    'native-row-clipping-disagrees-with-viewport'
  );
});

it('cannot relabel a matching native cell and inner as a different requested post', () => {
  const d = fixture();
  d.request.rows[0].key = 'other';
  d.bracket.requiredKeys = ['other'];
  expect(d.assess().issues).toContain('native-ruler-request-key-mismatch');
});
it('a malformed same-walk ruler inventory rejects without throwing', () => {
  const d = fixture();
  d.raw.ruler.surfaces = [null];
  expect(d.assess().snapshot.measurement?.valid).toBe(false);
});
