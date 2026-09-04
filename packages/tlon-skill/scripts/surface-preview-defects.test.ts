import { describe, expect, it } from 'bun:test';

import { SURFACE_JARGON_TERMS } from './surface-lint';
import {
  MIN_CONTROL_GAP,
  MIN_CONTROL_HEIGHT,
  MIN_CONTROL_WIDTH,
  PREVIEW_DEFECTS_NOT_CHECKED,
  PREVIEW_PROBE_EXPRESSION,
  type PreviewCellObservation,
  type PreviewElementObservation,
  findCellDefects,
  groupDefects,
} from './surface-preview-defects';

/**
 * The two arms of the defect pass's negative control.
 *
 * **The fulcrum is the observation's own numbers and text** — the layout
 * metrics and the rendered string the probe brings back from the app frame.
 * That is the only thing that decides whether a defect is reported, and in this
 * test's world the only thing that can move it is the fixture below. So the two
 * arms are the SAME observation with one measurement changed, and any rule that
 * stopped reading its input would show up as both arms agreeing.
 *
 * The good arm exists because "finds a defect in a bad app" is satisfied by a
 * checker that reports everything, and the bad arm exists because "finds
 * nothing in a good app" is satisfied by a checker that reports nothing. Only
 * the pair says anything.
 */
function element(
  overrides: Partial<PreviewElementObservation> = {}
): PreviewElementObservation {
  return {
    descriptor: 'button.tsh-button',
    text: 'Add a session',
    left: 16,
    right: 200,
    top: 300,
    bottom: 342,
    width: 184,
    height: 42,
    clipped: false,
    ...overrides,
  };
}

function goodCell(): PreviewCellObservation {
  return {
    viewportWidth: 390,
    viewportHeight: 844,
    documentScrollWidth: 390,
    overflowing: [],
    controls: [element()],
    text: 'This week Add a session Nobody has logged one yet.',
  };
}

describe('findCellDefects — the good arm', () => {
  it('finds nothing in a clean cell', () => {
    expect(findCellDefects('phone-initial-light', goodCell())).toEqual([]);
  });

  it('does not fire on the Button primitive’s own 42px height', () => {
    // The rubric says explicitly that "the primitive is too small" is never
    // the finding. A threshold at or above 42 would make every default button
    // in every app a defect, which is the same uselessness as a checker that
    // reports nothing, reached from the other side.
    expect(MIN_CONTROL_HEIGHT).toBeLessThan(42);
    const cell = goodCell();
    cell.controls = [element({ height: 42, top: 300, bottom: 342 })];
    expect(findCellDefects('phone-initial-light', cell)).toEqual([]);
  });
});

describe('findCellDefects — viewport overflow (rubric 1)', () => {
  it('reports a screen that scrolls sideways, with the overshoot', () => {
    const cell = goodCell();
    cell.documentScrollWidth = 452;
    const defects = findCellDefects('phone-populated-light', cell);
    expect(defects).toHaveLength(1);
    expect(defects[0]).toMatchObject({
      check: 'overflow',
      rubricCheck: 1,
      cell: 'phone-populated-light',
    });
    expect(defects[0].message).toContain('62px wider than the 390px viewport');
  });

  it('names the element that crosses the edge, and by how much', () => {
    const cell = goodCell();
    cell.overflowing = [
      element({
        descriptor: 'canvas.tsh-chart',
        text: '',
        left: 16,
        right: 452,
        width: 436,
      }),
    ];
    const defects = findCellDefects('phone-full-populated-dark', cell);
    expect(defects).toHaveLength(1);
    expect(defects[0].message).toBe(
      'canvas.tsh-chart runs 62px past the right edge of the 390px viewport'
    );
  });

  it('says nothing when the same element sits inside the edge', () => {
    // The fulcrum, moved: one number, nothing else.
    const cell = goodCell();
    cell.overflowing = [
      element({ descriptor: 'canvas.tsh-chart', right: 374, width: 358 }),
    ];
    expect(findCellDefects('phone-full-populated-dark', cell)).toEqual([]);
  });
});

describe('findCellDefects — tap-target geometry (rubric 2)', () => {
  it('reports a control squashed below the height a finger can hit', () => {
    const cell = goodCell();
    cell.controls = [element({ height: 18, top: 300, bottom: 318 })];
    const defects = findCellDefects('phone-initial-light', cell);
    expect(defects.map((defect) => defect.check)).toEqual(['tap-targets']);
    expect(defects[0].message).toContain('is 18px tall');
    expect(defects[0].message).toContain('a Button renders at 42px');
  });

  it('reports a control narrower than a reachable target', () => {
    const cell = goodCell();
    cell.controls = [element({ text: '+', left: 16, right: 44, width: 28 })];
    const defects = findCellDefects('phone-initial-light', cell);
    expect(defects).toHaveLength(1);
    expect(defects[0].message).toContain(
      `is 28px wide, under the ${MIN_CONTROL_WIDTH}px`
    );
  });

  it('reports a control narrower than its own label', () => {
    const cell = goodCell();
    cell.controls = [element({ clipped: true })];
    const defects = findCellDefects('desktop-initial-light', cell);
    expect(defects).toHaveLength(1);
    expect(defects[0].message).toContain('narrower than its own label');
  });

  it('reports two controls crowded together on one row', () => {
    const cell = goodCell();
    cell.controls = [
      element({ text: 'Yes', left: 16, right: 120, width: 104 }),
      element({ text: 'No', left: 123, right: 227, width: 104 }),
    ];
    const defects = findCellDefects('phone-initial-light', cell);
    expect(defects).toHaveLength(1);
    expect(defects[0].message).toBe(
      `button.tsh-button ("Yes") and button.tsh-button ("No") sit 3px apart on the same row, under the ${MIN_CONTROL_GAP}px minimum gap`
    );
  });

  it('says nothing about the same pair one pixel further apart', () => {
    // The fulcrum: the gap between two rects. 3px is crowded, 6px is the
    // smallest gap the shell's own spacing scale offers.
    const cell = goodCell();
    cell.controls = [
      element({ text: 'Yes', left: 16, right: 120, width: 104 }),
      element({ text: 'No', left: 126, right: 230, width: 104 }),
    ];
    expect(findCellDefects('phone-initial-light', cell)).toEqual([]);
  });

  it('does not read two controls on different rows as crowded', () => {
    const cell = goodCell();
    cell.controls = [
      element({ text: 'Yes', left: 16, right: 120, top: 300, bottom: 342 }),
      element({ text: 'No', left: 121, right: 225, top: 350, bottom: 392 }),
    ];
    expect(findCellDefects('phone-initial-light', cell)).toEqual([]);
  });
});

describe('findCellDefects — jargon in rendered text (rubric 6)', () => {
  it('reports a denylisted word that reached the screen', () => {
    const cell = goodCell();
    cell.text = 'This week 3 sessions since the last rollover Add a session';
    const defects = findCellDefects('phone-populated-light', cell);
    expect(defects).toHaveLength(1);
    expect(defects[0]).toMatchObject({ check: 'no-jargon', rubricCheck: 6 });
    expect(defects[0].message).toContain('the word "rollover" is on screen');
  });

  it('does not fire on the word inside a longer one', () => {
    // The gate's own pattern shape: `(?<![\w$])term(?![\w])`. Without the
    // boundaries "specific" and "invoked" would both be findings, the model
    // would learn the list is noise, and the check would be worse than absent.
    const cell = goodCell();
    cell.text = 'Specifically, the invoiced amount and the scratchpad';
    expect(findCellDefects('phone-initial-light', cell)).toEqual([]);
  });

  it('matches every term the gate denies, and only through this list', () => {
    for (const term of SURFACE_JARGON_TERMS) {
      const cell = goodCell();
      cell.text = `the ${term} is here`;
      const defects = findCellDefects('phone-initial-light', cell);
      expect(defects.map((defect) => defect.message)).toEqual([
        `the word "${term}" is on screen — it describes how the app works, not what the member is doing`,
      ]);
    }
  });
});

describe('groupDefects', () => {
  it('collapses one defect seen in many cells to one line', () => {
    const defects = [
      'phone-initial-light',
      'phone-initial-dark',
      'phone-populated-light',
    ].flatMap((cell) => {
      const observation = goodCell();
      observation.documentScrollWidth = 452;
      return findCellDefects(cell, observation);
    });
    const grouped = groupDefects(defects);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].cells).toEqual([
      'phone-initial-light',
      'phone-initial-dark',
      'phone-populated-light',
    ]);
  });

  it('keeps two different defects apart', () => {
    const observation = goodCell();
    observation.documentScrollWidth = 452;
    observation.text = 'the rollover happens on Monday';
    const grouped = groupDefects(
      findCellDefects('phone-initial-light', observation)
    );
    expect(grouped.map((entry) => entry.check)).toEqual([
      'overflow',
      'no-jargon',
    ]);
  });
});

describe('the probe script', () => {
  it('is written so a frame without a shell root answers null', () => {
    // How the caller tells the app frame from the host frame. If this stopped
    // being true, every cell would be measured against the HOST page — which
    // has no app in it, never overflows, and has no controls — and the pass
    // would report a clean bill of health for every app forever.
    expect(PREVIEW_PROBE_EXPRESSION).toContain(
      "var root = document.querySelector('.tsh-root');"
    );
    expect(PREVIEW_PROBE_EXPRESSION).toContain('if (!root) { return null; }');
  });

  it('states what it did not check, on every run', () => {
    expect(PREVIEW_DEFECTS_NOT_CHECKED.length).toBeGreaterThan(3);
    const all = PREVIEW_DEFECTS_NOT_CHECKED.join(' ');
    // The three rubric checks nothing mechanical can reach at all.
    expect(all).toContain('checks 4, 5 and 7');
    expect(all).toContain('colour');
  });
});
