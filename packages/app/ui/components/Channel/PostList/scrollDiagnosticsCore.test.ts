import { describe, expect, test } from 'vitest';

import {
  AdjustTracker,
  FrameSample,
  FrameTally,
  ScrollDiagEvent,
  ScrollDiagRecorder,
  activityAt,
  analyzeShift,
  describeChanges,
  describeKeyDiff,
  describeLateFrame,
  diffKeys,
  judgeShift,
  missedFrames,
} from './scrollDiagnosticsCore';

function frame(
  scroll: number,
  rows: Array<[key: string, position: number]>,
  overrides: Partial<FrameSample> = {}
): FrameSample {
  return {
    atEnd: false,
    blank: 0,
    content: 5000,
    nearEnd: false,
    rows: rows.map(([key, position]) => ({ key, position, size: 100 })),
    scroll,
    topPad: 0,
    viewport: 800,
    ...overrides,
  };
}

const idle = { causes: [], hidden: false, phase: 'idle' as const };

describe('diffKeys', () => {
  test('recognizes an older page added above the surviving rows', () => {
    const diff = diffKeys(['c', 'd'], ['a', 'b', 'c', 'd']);
    expect(diff).toMatchObject({ kind: 'prepend', addedAtStart: 2 });
    expect(describeKeyDiff(diff)).toBe('+top 2');
  });

  test('recognizes new rows at the bottom', () => {
    expect(diffKeys(['a', 'b'], ['a', 'b', 'c'])).toMatchObject({
      kind: 'append',
      addedAtEnd: 1,
    });
  });

  test('separates a swapped final row from a plain append', () => {
    const diff = diffKeys(['a', 'b', 'pending'], ['a', 'b', 'confirmed']);
    expect(diff).toMatchObject({
      kind: 'mixed',
      addedAtEnd: 1,
      removedAtEnd: 1,
    });
    expect(describeKeyDiff(diff)).toBe('+bottom 1, -bottom 1');
  });

  test('reports rows removed from the middle', () => {
    expect(diffKeys(['a', 'b', 'c'], ['a', 'c'])).toMatchObject({
      kind: 'mixed',
      removedInside: 1,
      added: 0,
    });
  });

  test('reports a full replacement and a reorder', () => {
    expect(diffKeys(['a', 'b'], ['x', 'y']).kind).toBe('replaced');
    expect(diffKeys(['a', 'b', 'c'], ['a', 'c', 'b']).reordered).toBe(true);
  });

  test('treats identical keys as no change', () => {
    expect(diffKeys(['a', 'b'], ['a', 'b']).kind).toBe('none');
    expect(diffKeys([], ['a']).kind).toBe('initial');
    expect(diffKeys(['a'], []).kind).toBe('cleared');
  });
});

describe('analyzeShift', () => {
  const before = frame(1000, [
    ['a', 1000],
    ['b', 1100],
  ]);

  test('rows that keep their place while the offset moves are scrolling', () => {
    const analysis = analyzeShift(
      before,
      frame(1040, [
        ['a', 1000],
        ['b', 1100],
      ])
    );
    expect(analysis).toMatchObject({ kind: 'scroll', otherScroll: 40 });
  });

  test('a row growing above the viewport is invisible when the list corrects for it', () => {
    const analysis = analyzeShift(
      before,
      frame(1180, [
        ['a', 1180],
        ['b', 1280],
      ]),
      180
    );
    expect(analysis).toMatchObject({
      kind: 'compensated',
      layoutDelta: 180,
      uncorrected: 0,
    });
  });

  test('a correction is still recognized while a gesture also moves the offset', () => {
    const analysis = analyzeShift(
      before,
      frame(1100, [
        ['a', 1180],
        ['b', 1280],
      ]),
      180
    );
    expect(analysis).toMatchObject({
      kind: 'compensated',
      uncorrected: 0,
      otherScroll: -80,
    });
  });

  test('the same growth with no correction is a shift', () => {
    const analysis = analyzeShift(
      before,
      frame(1000, [
        ['a', 1180],
        ['b', 1280],
      ])
    );
    expect(analysis).toMatchObject({ kind: 'shift', uncorrected: 180 });
  });

  test('padding above the rows counts as row movement', () => {
    const analysis = analyzeShift(
      frame(0, [['a', 0]], { topPad: 300 }),
      frame(0, [['a', 0]], { topPad: 200 })
    );
    expect(analysis).toMatchObject({ kind: 'shift', uncorrected: -100 });
  });

  test('a row in view changing height is a reflow', () => {
    const analysis = analyzeShift(
      frame(1000, [
        ['a', 1000],
        ['b', 1100],
        ['c', 1200],
      ]),
      frame(1000, [
        ['a', 1000],
        ['b', 1100],
        ['c', 1260],
      ])
    );
    expect(analysis).toMatchObject({ kind: 'reflow', spread: 60 });
  });

  test('no surviving row means the window was replaced', () => {
    const analysis = analyzeShift(
      frame(1000, [['a', 1000]]),
      frame(4000, [['z', 4000]])
    );
    expect(analysis.kind).toBe('replaced');
  });
});

describe('judgeShift', () => {
  const shift = analyzeShift(
    frame(1000, [['a', 1000]]),
    frame(1000, [['a', 1180]])
  );
  const offsetOnly = analyzeShift(
    frame(1000, [['a', 1000]]),
    frame(1300, [['a', 1000]])
  );

  test('flags rows moving on screen with nothing to explain it', () => {
    expect(judgeShift(shift, idle)).toMatchObject({
      type: 'shift',
      flag: 'jump',
    });
    expect(judgeShift(shift, { ...idle, phase: 'momentum' })?.flag).toBe(
      'jump'
    );
  });

  test('records but does not flag movement with a known cause', () => {
    const verdict = judgeShift(shift, { ...idle, causes: ['keyboard'] });
    expect(verdict?.flag).toBeUndefined();
    expect(verdict?.message).toContain('keyboard');
  });

  test('never flags movement while the list is hidden', () => {
    expect(judgeShift(shift, { ...idle, hidden: true })?.flag).toBeUndefined();
  });

  test('flags the offset moving by itself, but not during a drag', () => {
    expect(judgeShift(offsetOnly, idle)).toMatchObject({
      type: 'auto-scroll',
      flag: 'jump',
    });
    expect(judgeShift(offsetOnly, { ...idle, phase: 'drag' })).toBeNull();
  });

  test('records a compensated correction without flagging it', () => {
    const compensated = analyzeShift(
      frame(1000, [['a', 1000]]),
      frame(1180, [['a', 1180]]),
      180
    );
    expect(judgeShift(compensated, idle)).toMatchObject({ type: 'adjust' });
    expect(judgeShift(compensated, idle)?.flag).toBeUndefined();
  });

  test('records a row in view changing height', () => {
    const reflow = analyzeShift(
      frame(1000, [
        ['a', 1000],
        ['b', 1100],
      ]),
      frame(1000, [
        ['a', 1000],
        ['b', 1160],
      ])
    );
    expect(judgeShift(reflow, idle)).toMatchObject({ type: 'reflow' });
    expect(judgeShift(reflow, idle)?.flag).toBeUndefined();
  });

  test('says nothing about an unremarkable frame', () => {
    const still = analyzeShift(
      frame(1000, [['a', 1000]]),
      frame(1000, [['a', 1000]])
    );
    expect(judgeShift(still, idle)).toBeNull();
  });
});

describe('AdjustTracker', () => {
  test('matches a correction to the native step that carries it', () => {
    const tracker = new AdjustTracker();
    tracker.nativeScroll(0, 1000, 'idle');
    tracker.request(10, 180);
    const result = tracker.nativeScroll(26, 1180, 'idle');
    expect(result.landed).toEqual([{ t: 10, amount: 180, latency: 16 }]);
    expect(result.step).toBe(0);
    expect(tracker.hasPending()).toBe(false);
  });

  test('matches corrections that land together as a group', () => {
    const tracker = new AdjustTracker();
    tracker.nativeScroll(0, 1000, 'idle');
    tracker.request(10, -144.7);
    tracker.request(12, -84.4);
    const result = tracker.nativeScroll(30, 1000 - 229.1, 'idle');
    expect(result.landed.map((adjust) => adjust.amount)).toEqual([
      -144.7, -84.4,
    ]);
    expect(tracker.hasPending()).toBe(false);
  });

  test('finds a correction inside a fling using UI-thread time', () => {
    const tracker = new AdjustTracker();
    // Events reach JS in one burst at t=100 but happened 8ms apart.
    tracker.nativeScroll(100, 1000, 'momentum', 5000);
    tracker.nativeScroll(100, 960, 'momentum', 5008);
    tracker.request(60, 180);
    const result = tracker.nativeScroll(100, 1060, 'momentum', 5024);
    // The fling alone would have moved -80 over 16ms.
    expect(result.landed.map((adjust) => adjust.amount)).toEqual([180]);
    expect(result.step).toBe(0);
  });

  test('reports the true latency of a correction when events reach JS late', () => {
    const tracker = new AdjustTracker();
    // The first event arrives promptly, which pins the two clocks together.
    tracker.nativeScroll(1000, 500, 'idle', 9000);
    tracker.request(1010, 100);
    // It lands 16ms later on the UI thread but JS only hears 300ms after.
    const result = tracker.nativeScroll(1316, 600, 'idle', 9016);
    expect(result.landed[0].latency).toBe(6);
  });

  test('reports an abrupt step in the middle of a fling', () => {
    const tracker = new AdjustTracker();
    tracker.nativeScroll(0, 1000, 'momentum', 0);
    tracker.nativeScroll(8, 960, 'momentum', 8);
    expect(tracker.nativeScroll(16, 700, 'momentum', 16).step).toBe(-220);
    // The step is not mistaken for the fling's new speed.
    expect(tracker.nativeScroll(24, 660, 'momentum', 24).step).toBe(0);
    // A finger may change speed however it likes.
    const dragging = new AdjustTracker();
    dragging.nativeScroll(0, 1000, 'drag', 0);
    dragging.nativeScroll(8, 960, 'drag', 8);
    expect(dragging.nativeScroll(16, 700, 'drag', 16).step).toBe(0);
  });

  test('reports an idle step that no correction explains', () => {
    const tracker = new AdjustTracker();
    tracker.nativeScroll(0, 1000, 'idle');
    expect(tracker.nativeScroll(16, 1060, 'idle').step).toBe(60);
  });

  test('expires corrections the native offset never showed', () => {
    const tracker = new AdjustTracker(150);
    tracker.nativeScroll(0, 1000, 'idle');
    tracker.request(10, 180);
    tracker.nativeScroll(30, 1000, 'idle');
    expect(tracker.expire(100)).toEqual([]);
    expect(tracker.expire(200)).toEqual([{ t: 10, amount: 180 }]);
    expect(tracker.hasPending()).toBe(false);
  });
});

describe('ScrollDiagRecorder', () => {
  test('counts flags and returns the lead-up to an event for one conversation', () => {
    let now = 0;
    const recorder = new ScrollDiagRecorder(100, () => now);
    recorder.record({ list: 'chat#1', type: 'data', message: 'old' });
    now = 900;
    recorder.record({ list: 'other#1', type: 'data', message: 'elsewhere' });
    recorder.record({ list: 'chat', type: 'page', message: 'start reached' });
    now = 1000;
    recorder.record({ list: 'chat#1', type: 'size', message: 'rows grew' });
    const jump = recorder.record({
      list: 'chat#1',
      type: 'shift',
      message: 'rows moved',
      flag: 'jump',
    });

    expect(recorder.getCounts()).toEqual({
      jump: 1,
      flicker: 0,
      warn: 0,
      hitch: 0,
    });
    expect(
      recorder.contextFor(jump, 500).map((event) => event.message)
    ).toEqual(['start reached', 'rows grew']);
  });

  test('keeps only the most recent events', () => {
    const recorder = new ScrollDiagRecorder(10, () => 0);
    for (let i = 0; i < 40; i++) {
      recorder.record({ list: 'chat', type: 'n', message: String(i) });
    }
    const events = recorder.getEvents();
    expect(events.length).toBeLessThanOrEqual(13);
    expect(events[events.length - 1].message).toBe('39');
  });
});

test('describeChanges lists only the values that changed', () => {
  expect(
    describeChanges(
      { isNearEnd: true, mvcp: undefined, rows: 10 },
      { isNearEnd: false, mvcp: true, rows: 10 }
    )
  ).toEqual(['isNearEnd true→false', 'mvcp undefined→true']);
});

describe('frame pacing', () => {
  const FRAME = 1000 / 60;

  test('counts the frames the display went without', () => {
    expect(missedFrames({ gap: FRAME * 2, interval: FRAME })).toBe(1);
    expect(missedFrames({ gap: FRAME * 4.1, interval: FRAME })).toBe(3);
    // Anything reported as late missed at least one.
    expect(missedFrames({ gap: FRAME * 1.5, interval: FRAME })).toBe(1);
  });

  test('totals late time per second watched', () => {
    const tally = new FrameTally();
    tally.add(60, 1000, []);
    tally.add(57, 1000, [
      { gap: FRAME * 2, interval: FRAME },
      { gap: FRAME * 3, interval: FRAME },
    ]);

    expect(tally.summary()).toEqual({
      seconds: 2,
      frames: 117,
      lateFrames: 2,
      missedFrames: 3,
      hitchMs: 50,
      worstGapMs: 50,
      hitchMsPerSecond: 25,
    });

    tally.reset();
    expect(tally.summary().hitchMsPerSecond).toBe(0);
  });

  test('places an entry reported late where it happened', () => {
    let now = 0;
    const recorder = new ScrollDiagRecorder(100, () => now);
    recorder.record({ list: 'chat#1', type: 'data', message: 'first' });
    now = 500;
    recorder.record({ list: 'chat#1', type: 'data', message: 'third' });
    recorder.record({
      list: 'ui',
      type: 'frames',
      message: 'second',
      flag: 'hitch',
      at: 200,
    });

    expect(recorder.getEvents().map((event) => event.message)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(recorder.getCounts().hitch).toBe(1);
  });

  const timeline = (
    entries: Array<[t: number, list: string, type: string, message: string]>
  ): ScrollDiagEvent[] =>
    entries.map(([t, list, type, message], index) => ({
      seq: index + 1,
      t,
      list,
      type,
      message,
    }));

  test('names what was moving when a frame came late', () => {
    const events = timeline([
      [0, 'chat', 'nav', 'screen transition began'],
      [100, 'chat#1', 'lifecycle', 'list mounted with 30 rows (chat:latest)'],
      [400, 'chat', 'nav', 'screen transition ended'],
      [600, 'chat#1', 'visibility', 'list first shown 500ms after mounting'],
      [2000, 'chat#1', 'gesture', 'drag began'],
      [2300, 'chat#1', 'gesture', 'drag released'],
      [2310, 'chat#1', 'gesture', 'momentum began'],
      [3000, 'chat#1', 'gesture', 'momentum ended'],
    ]);

    expect(activityAt(events, 50)).toBe('a screen was sliding in');
    // The slide is what is on screen; the list behind it is still hidden.
    expect(activityAt(events, 300)).toBe('a screen was sliding in');
    expect(activityAt(events, 500)).toBe('opening chat');
    expect(activityAt(events, 1000)).toBeNull();
    expect(activityAt(events, 2100)).toBe('scrolling chat');
    expect(activityAt(events, 2305)).toBeNull();
    expect(activityAt(events, 2500)).toBe('scrolling chat');
    expect(activityAt(events, 3500)).toBeNull();
  });

  test('flags late frames that could be seen, and long stalls regardless', () => {
    const late = (frames: number) => ({
      t: 0,
      gap: FRAME * frames,
      interval: FRAME,
    });

    expect(describeLateFrame(late(2), 'scrolling chat')).toEqual({
      message:
        'UI thread missed 1 frame (33ms between frames) while scrolling chat',
      flag: undefined,
    });
    expect(describeLateFrame(late(3), 'scrolling chat').flag).toBe('hitch');
    expect(describeLateFrame(late(3), null)).toEqual({
      message:
        'UI thread missed 2 frames (50ms between frames) with nothing moving',
      flag: undefined,
    });
    expect(describeLateFrame(late(7), null).flag).toBe('hitch');
  });
});
