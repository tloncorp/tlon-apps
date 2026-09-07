import { describe, expect, it } from 'vitest';
import {
  adaptNativeScrollGeometry,
  type NativeGeometryCapture,
  type NativeGeometryRequest,
  type NativeGeometryView,
} from './scrollNativeGeometry';

function healthy() {
  const view = (
    identity: string,
    y: number,
    height: number,
    descendantOfScroll: boolean
  ): NativeGeometryView => ({
    identity,
    windowIdentity: 'window-1',
    frame: { x: 0, y, width: 400, height },
    clipFrame: { x: 0, y, width: 400, height },
    attached: true,
    effectiveAlpha: 1,
    hidden: false,
    translationOnly: true,
    descendantOfScroll,
  });
  const request: NativeGeometryRequest = {
    requestId: 'call-1',
    rootId: 'fixture-2',
    scrollViewId: 'conversation-5',
    composerId: 'composer',
    rows: [
      { key: 'reading', id: 'row-reading' },
      { key: 'nearby', id: 'row-nearby' },
    ],
  };
  const raw: NativeGeometryCapture = {
    version: 1,
    requestId: request.requestId,
    rootId: request.rootId,
    scrollViewId: request.scrollViewId,
    composerId: request.composerId,
    rowIds: request.rows.map((row) => row.id),
    clock: 'CACurrentMediaTime milliseconds',
    coordinateSpace: 'window-model-points',
    startedAt: 987650,
    finishedAt: 987652,
    status: 'ok',
    issues: [],
    visitedViews: 250,
    root: view('root', 0, 800, false),
    composer: view('composer', 600, 80, false),
    scroll: {
      view: view('scroll', 100, 600, true),
      hostIdentity: 'scroll-host',
      offset: { x: 0, y: 1000 },
      contentSize: { width: 400, height: 2000 },
      bounds: { x: 0, y: 1000, width: 400, height: 600 },
      contentInset: { top: 5, right: 0, bottom: 80, left: 0 },
      adjustedContentInset: { top: 25, right: 0, bottom: 100, left: 0 },
      zoomScale: 1,
      tracking: true,
      dragging: true,
      decelerating: false,
    },
    rows: [
      {
        id: 'row-reading',
        matches: 1,
        view: view('reading-view', 220, 120, true),
      },
      {
        id: 'row-nearby',
        matches: 1,
        view: view('nearby-view', 340, 200, true),
      },
    ],
  };
  const bracket = {
    requestedAt: 100,
    receivedAt: 110,
    requiredKeys: ['reading'],
    populated: true,
  };
  return { raw, request, bracket };
}
const assess = (evidence: ReturnType<typeof healthy>) =>
  adaptNativeScrollGeometry(evidence.raw, evidence.request, evidence.bracket);

describe('coherent iOS native geometry adapter', () => {
  it('uses one native operation for rows, actual extent, viewport and adjusted legal bounds', () => {
    const evidence = healthy();
    const { snapshot, issues } = assess(evidence);
    expect(issues).toEqual([]);
    expect(snapshot.measurement).toEqual({ valid: true, durationMs: 10 });
    expect(snapshot).toMatchObject({
      time: 110,
      scroll: 1000,
      contentLength: 2000,
      viewportHeight: 600,
      viewportTop: 100,
      viewportBottom: 600,
      scrollBounds: { min: -25, max: 1500 },
      keyboardHeight: 100,
    });
    expect(snapshot.rows).toEqual([
      { key: 'reading', y: 220, height: 120 },
      { key: 'nearby', y: 340, height: 200 },
    ]);
    expect(snapshot.acquisition?.nativeGeometry).toMatchObject({
      nativePresentation: 'INCOMPLETE',
      capture: { startedAt: 987650 },
      bracket: { requestedAt: 100, receivedAt: 110 },
    });
  });
  it('allows a known optional offscreen wrapper to be unmounted without inventing a row', () => {
    const evidence = healthy();
    evidence.raw.rows![1] = { id: 'row-nearby', matches: 0 };
    expect(assess(evidence).issues).toEqual([]);
    expect(assess(evidence).snapshot.rows).toHaveLength(1);
  });
  it('allows actual empty data only when all required native structural witnesses still exist', () => {
    const evidence = healthy();
    evidence.request.rows = [];
    evidence.raw.rowIds = [];
    evidence.raw.rows = [];
    evidence.bracket.requiredKeys = [];
    evidence.bracket.populated = false;
    expect(assess(evidence).issues).toEqual([]);
    delete evidence.raw.composer;
    expect(assess(evidence).snapshot.measurement?.valid).toBe(false);
  });
  it('does not clip with a composer that has no horizontal overlap', () => {
    const evidence = healthy();
    evidence.raw.composer!.frame.x = 500;
    evidence.raw.composer!.clipFrame.x = 500;
    expect(assess(evidence).snapshot.viewportBottom).toBe(700);
  });
  it('rejects full row bounds that falsely appear visible through a clipping ancestor', () => {
    const e = healthy();
    e.raw.rows![0].view!.clipFrame = { x: 0, y: 0, width: 0, height: 0 };
    expect(assess(e).issues).toContain(
      'native-row-clipping-disagrees-with-viewport'
    );
    expect(assess(e).snapshot.measurement?.valid).toBe(false);
  });
  it('rejects a compositor frame whose actual clipped area is empty', () => {
    const e = healthy();
    e.raw.composer!.clipFrame = { x: 0, y: 0, width: 0, height: 0 };
    expect(assess(e).issues).toContain('invalid-native-composer');
  });
  it('accepts an offscreen measured row with an empty clip instead of inventing visible content', () => {
    const e = healthy();
    e.raw.rows![1].view!.frame.y = 2000;
    e.raw.rows![1].view!.clipFrame = { x: 0, y: 0, width: 0, height: 0 };
    expect(assess(e).issues).toEqual([]);
    expect(assess(e).snapshot.acquisition?.visibleMeasuredRowCount).toBe(1);
  });
  const faults: [string, (e: ReturnType<typeof healthy>) => void][] = [
    [
      'wrong request',
      (e) => {
        e.raw.requestId = 'old-call';
      },
    ],
    [
      'wrong root',
      (e) => {
        e.raw.rootId = 'other-generation';
      },
    ],
    [
      'wrong scroll host',
      (e) => {
        e.raw.scrollViewId = 'other-channel';
      },
    ],
    [
      'wrong composer',
      (e) => {
        e.raw.composerId = 'foreign-composer';
      },
    ],
    [
      'wrong row order',
      (e) => {
        e.raw.rows!.reverse();
      },
    ],
    [
      'missing inventory',
      (e) => {
        e.raw.rows!.pop();
      },
    ],
    [
      'extra row',
      (e) => {
        e.raw.rows!.push({ ...e.raw.rows![0] });
      },
    ],
    [
      'duplicate requested key',
      (e) => {
        e.request.rows[1].key = 'reading';
      },
    ],
    [
      'duplicate requested identifier',
      (e) => {
        e.request.rows[1].id = 'row-reading';
      },
    ],
    [
      'root and row alias',
      (e) => {
        e.request.rootId = 'row-reading';
      },
    ],
    [
      'duplicate native row match',
      (e) => {
        e.raw.rows![0].matches = 2;
      },
    ],
    [
      'aliased native row object',
      (e) => {
        e.raw.rows![1].view!.identity = 'reading-view';
      },
    ],
    [
      'missing required row',
      (e) => {
        e.raw.rows![0] = { id: 'row-reading', matches: 0 };
      },
    ],
    [
      'missing row with invented frame',
      (e) => {
        e.raw.rows![0].matches = 0;
      },
    ],
    [
      'required row never requested',
      (e) => {
        e.bracket.requiredKeys.push('missing');
      },
    ],
    [
      'foreign row owner',
      (e) => {
        e.raw.rows![0].view!.descendantOfScroll = false;
      },
    ],
    [
      'foreign row window',
      (e) => {
        e.raw.rows![0].view!.windowIdentity = 'other-window';
      },
    ],
    [
      'foreign composer window',
      (e) => {
        e.raw.composer!.windowIdentity = 'other-window';
      },
    ],
    [
      'composer incorrectly inside list',
      (e) => {
        e.raw.composer!.descendantOfScroll = true;
      },
    ],
    [
      'detached root',
      (e) => {
        e.raw.root!.attached = false;
      },
    ],
    [
      'hidden root',
      (e) => {
        e.raw.root!.hidden = true;
      },
    ],
    [
      'transparent viewport',
      (e) => {
        e.raw.scroll!.view.effectiveAlpha = 0;
      },
    ],
    [
      'hidden required row',
      (e) => {
        e.raw.rows![0].view!.hidden = true;
      },
    ],
    [
      'missing composer',
      (e) => {
        delete e.raw.composer;
      },
    ],
    [
      'occluded viewport',
      (e) => {
        e.raw.composer!.frame.y = 0;
        e.raw.composer!.clipFrame.y = 0;
      },
    ],
    [
      'invalid clip',
      (e) => {
        e.raw.scroll!.view.clipFrame.height = 999;
      },
    ],
    [
      'transformed coordinates',
      (e) => {
        e.raw.scroll!.view.translationOnly = false;
      },
    ],
    [
      'native zoom',
      (e) => {
        e.raw.scroll!.zoomScale = 2;
      },
    ],
    [
      'offset bounds mismatch',
      (e) => {
        e.raw.scroll!.bounds.y = 800;
      },
    ],
    [
      'frame bounds mismatch',
      (e) => {
        e.raw.scroll!.bounds.height = 599;
      },
    ],
    [
      'nonfinite actual extent',
      (e) => {
        e.raw.scroll!.contentSize.height = NaN;
      },
    ],
    [
      'negative actual extent',
      (e) => {
        e.raw.scroll!.contentSize.height = -1;
      },
    ],
    [
      'nonfinite inset',
      (e) => {
        e.raw.scroll!.adjustedContentInset.bottom = Infinity;
      },
    ],
    [
      'JS timeout',
      (e) => {
        e.bracket.receivedAt = 140;
      },
    ],
    [
      'reversed JS clock',
      (e) => {
        e.bracket.receivedAt = 99;
      },
    ],
    [
      'reversed native clock',
      (e) => {
        e.raw.finishedAt = e.raw.startedAt - 1;
      },
    ],
    [
      'native duration outside JS bracket',
      (e) => {
        e.raw.finishedAt = e.raw.startedAt + 12;
      },
    ],
    [
      'slow native operation',
      (e) => {
        e.raw.finishedAt = e.raw.startedAt + 33;
      },
    ],
    [
      'wrong native clock domain',
      (e) => {
        e.raw.clock = 'Date.now' as never;
      },
    ],
    [
      'wrong coordinate space',
      (e) => {
        e.raw.coordinateSpace = 'screen-pixels' as never;
      },
    ],
    [
      'native lookup error',
      (e) => {
        e.raw.status = 'unavailable';
        e.raw.issues = ['duplicate-root'];
      },
    ],
    [
      'ignored native error',
      (e) => {
        e.raw.issues = ['view-traversal-limit'];
      },
    ],
    [
      'over-limit tree',
      (e) => {
        e.raw.visitedViews = 20001;
      },
    ],
    [
      'missing native metrics',
      (e) => {
        delete e.raw.scroll;
      },
    ],
    [
      'populated list missing every row',
      (e) => {
        e.bracket.requiredKeys = [];
        e.raw.rows = e.raw.rows!.map((row) => ({ id: row.id, matches: 0 }));
      },
    ],
    [
      'oversized request',
      (e) => {
        e.request.rows = Array.from({ length: 129 }, (_, i) => ({
          id: `row-${i}`,
          key: String(i),
        }));
        e.raw.rowIds = e.request.rows.map((row) => row.id);
        e.raw.rows = e.raw.rowIds.map((id) => ({ id, matches: 0 }));
        e.bracket.requiredKeys = [];
        e.bracket.populated = false;
      },
    ],
  ];
  it.each(faults)(
    'rejects %s without claiming a scroll outcome',
    (_label, mutate) => {
      const evidence = healthy();
      expect(assess(evidence).snapshot.measurement?.valid).toBe(true);
      mutate(evidence);
      expect(assess(evidence).snapshot.measurement?.valid).toBe(false);
      expect(assess(evidence).issues.length).toBeGreaterThan(0);
    }
  );
  it.each([null, undefined, {}, { status: 'unavailable' }])(
    'fails closed for unavailable/malformed native data %j',
    (raw) => {
      const e = healthy();
      expect(
        adaptNativeScrollGeometry(raw, e.request, e.bracket).snapshot
          .measurement?.valid
      ).toBe(false);
    }
  );
});
