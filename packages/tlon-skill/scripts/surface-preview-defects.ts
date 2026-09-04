import { SURFACE_JARGON_TERMS } from './surface-lint';

/**
 * `surface preview`'s machine-checked defect pass.
 *
 * ## Why this exists, and what it is honestly for
 *
 * Session 6a: six runs reached preview, and the model scored the rubric in
 * none of them. Twelve capture cells were written each time and 3, 3, 0, 1, 1
 * and 3 of them were opened. `surface rubric` was run in three of those runs —
 * the doctrine reached the model and changed nothing. The one run that
 * repaired against visual feedback did so because a tool handed it **a list of
 * concrete defects**.
 *
 * So this pass does not score the rubric and does not pretend to. It measures
 * the three things mechanics can actually reach across a real render, and it
 * emits them as a list with a cell name, a number and an element on every
 * line. Its purpose is to remove the excuse for finding nothing — not to
 * replace the looking.
 *
 * ## The three checks
 *
 * 1. **Viewport overflow**, from layout metrics. `documentElement.scrollWidth`
 *    against the viewport, plus the outermost elements whose rect crosses the
 *    right edge. Only the outermost: a card that runs past the edge drags
 *    every child with it, and twenty lines naming the children buries the one
 *    element that has to be repaired.
 * 2. **Tap-target geometry.** Not "the primitive is too small" — `RUBRIC.md`
 *    says explicitly that is never the finding, and the `Button` primitive
 *    renders at 42px. The measurable findings are the ones the rubric names:
 *    controls crowded together on a row, a control squeezed narrower than a
 *    reachable target, a control whose own label is clipped.
 * 3. **The jargon denylist against RENDERED text.** The same
 *    `SURFACE_JARGON_TERMS` the gate uses, imported rather than copied, run
 *    over what a real browser actually painted in each of the twelve cells.
 *
 * ## What check 3 adds over the gate, since the gate already runs it
 *
 * The gate runs this denylist twice already — lexically over string literals,
 * and over a happy-dom smoke render of `initialState` plus one activation
 * pass. This pass is not a third copy for its own sake. It differs in three
 * ways that matter:
 *
 * - it reads a **real Chromium render**, so text that only exists after real
 *   layout or that a chart draws is in scope where happy-dom's is not;
 * - it reads the **populated state** — every declared action folded twice
 *   across three actors — so a word that only appears once somebody else has
 *   acted is reachable here and is not reachable from `initialState`;
 * - it reads text assembled at runtime from state, which the lexical half
 *   cannot see at all.
 *
 * Where they overlap, they agree, and the gate has already refused the publish
 * before preview runs. That is fine: this pass exists to be read by a model
 * mid-loop, not to be the enforcement point.
 *
 * ## What this pass does NOT check
 *
 * Stated in code, printed in the output, and repeated in the report, because a
 * clean machine pass read as a clean app is the failure mode this whole
 * mechanism could most easily create. See `PREVIEW_DEFECTS_NOT_CHECKED`.
 */

/* ------------------------------------------------------------------ */
/* Thresholds                                                          */
/* ------------------------------------------------------------------ */

/**
 * Below the 42px the `Button` primitive renders at (8px padding top and
 * bottom, a 24px line box, 1px borders), so the primitive as shipped can never
 * trip this and every hit is something that squashed a control. A threshold at
 * or above 42 would fire on every default button in every app, which is the
 * checker that reports everything — the same uselessness as the one that
 * reports nothing, reached from the other side.
 */
export const MIN_CONTROL_HEIGHT = 40;

/** WCAG 2.5.5's target size. The default button is far wider than this. */
export const MIN_CONTROL_WIDTH = 44;

/**
 * `--space-s`, the smallest gap on the shell's own spacing scale. A gap
 * narrower than the smallest gap the design system offers was not chosen; it
 * is what a row that ran out of width produces.
 */
export const MIN_CONTROL_GAP = 6;

/** Subpixel slack, so a 390.0001px layout is not a finding. */
const EDGE_TOLERANCE = 1;

/* ------------------------------------------------------------------ */
/* What one cell's probe brings back                                   */
/* ------------------------------------------------------------------ */

export interface PreviewElementObservation {
  /** `button.tsh-button` — tag plus up to two classes */
  descriptor: string;
  /** the element's own visible text, trimmed, for aiming a repair */
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  /** the element's content is wider than its box */
  clipped: boolean;
}

export interface PreviewCellObservation {
  viewportWidth: number;
  viewportHeight: number;
  documentScrollWidth: number;
  /** outermost elements crossing the right edge, at most a handful */
  overflowing: PreviewElementObservation[];
  controls: PreviewElementObservation[];
  /** everything the cell painted, whitespace-collapsed */
  text: string;
}

export type PreviewDefectCheck = 'overflow' | 'tap-targets' | 'no-jargon';

export interface PreviewDefect {
  cell: string;
  check: PreviewDefectCheck;
  /** the numbered check in `RUBRIC.md` this belongs to */
  rubricCheck: number;
  /**
   * Identical for the same defect seen in different cells, so the report can
   * collapse "the chart overflows" from eight lines to one with eight cells
   * named. Grouping on the message alone would merge two different elements
   * that happened to overflow by the same amount.
   */
  key: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/* The probe — plain text, so it is reviewable without a browser       */
/* ------------------------------------------------------------------ */

/**
 * Runs inside the app frame, in Playwright's isolated world.
 *
 * It has to be evaluated in the FRAME, not the host page: the sandbox is
 * `allow-scripts` only, so it has an opaque origin and `contentDocument` is
 * null from the host. Playwright reaches it anyway, which is the only reason
 * this check is possible at all.
 *
 * Returns `null` when there is no shell root, which is how the caller tells
 * the app frame apart from the host frame — and how a cell that could not be
 * probed is reported as unprobed rather than as clean.
 */
export const PREVIEW_PROBE_EXPRESSION = `(() => {
  var root = document.querySelector('.tsh-root');
  if (!root) { return null; }
  var vw = document.documentElement.clientWidth || window.innerWidth;
  var vh = document.documentElement.clientHeight || window.innerHeight;

  function describe(el) {
    var tag = el.tagName.toLowerCase();
    var raw = el.getAttribute('class') || '';
    var classes = raw.split(/\\s+/).filter(Boolean).slice(0, 2);
    return tag + classes.map(function (c) { return '.' + c; }).join('');
  }
  function label(el) {
    var t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    return t.length > 48 ? t.slice(0, 48) + '\\u2026' : t;
  }
  function visible(el) {
    var s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') { return false; }
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function measure(el) {
    var r = el.getBoundingClientRect();
    return {
      descriptor: describe(el),
      text: label(el),
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height),
      clipped: el.scrollWidth > el.clientWidth + 1
    };
  }
  function pastRight(el) {
    return el.getBoundingClientRect().right > vw + 1;
  }

  var overflowing = [];
  var all = root.querySelectorAll('*');
  for (var i = 0; i < all.length && overflowing.length < 8; i++) {
    var el = all[i];
    if (!visible(el) || !pastRight(el)) { continue; }
    var covered = false;
    var p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      if (pastRight(p)) { covered = true; break; }
      p = p.parentElement;
    }
    if (!covered) { overflowing.push(measure(el)); }
  }

  var controls = [];
  var nodes = root.querySelectorAll(
    'button, [role="button"], a[href], input, select, textarea, summary'
  );
  for (var j = 0; j < nodes.length && controls.length < 60; j++) {
    if (visible(nodes[j])) { controls.push(measure(nodes[j])); }
  }

  return {
    viewportWidth: vw,
    viewportHeight: vh,
    documentScrollWidth: document.documentElement.scrollWidth,
    overflowing: overflowing,
    controls: controls,
    text: (root.textContent || '').replace(/\\s+/g, ' ').trim()
  };
})()`;

/* ------------------------------------------------------------------ */
/* The rules — pure, so they are testable without a browser            */
/* ------------------------------------------------------------------ */

/**
 * The gate's own pattern shape, for the gate's own term list. Mirrored rather
 * than imported because `surface-lint.ts` does not export it; the TERMS are
 * imported, which is the half that would actually drift.
 */
function jargonPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w$])${escaped}(?![\\w])`, 'i');
}

function where(element: PreviewElementObservation): string {
  return element.text.length > 0
    ? `${element.descriptor} ("${element.text}")`
    : element.descriptor;
}

/** True when two rects share enough vertical extent to be "on one row". */
function sameRow(
  a: PreviewElementObservation,
  b: PreviewElementObservation
): boolean {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const shorter = Math.min(a.height, b.height);
  return shorter > 0 && overlap > shorter / 2;
}

export function findCellDefects(
  cell: string,
  observation: PreviewCellObservation
): PreviewDefect[] {
  const defects: PreviewDefect[] = [];
  const add = (
    check: PreviewDefectCheck,
    rubricCheck: number,
    key: string,
    message: string
  ) => {
    defects.push({ cell, check, rubricCheck, key, message });
  };

  /* 1 — overflow */

  const overshoot = observation.documentScrollWidth - observation.viewportWidth;
  if (overshoot > EDGE_TOLERANCE) {
    add(
      'overflow',
      1,
      'overflow:document',
      `the screen scrolls sideways: its content is ${overshoot}px wider than the ${observation.viewportWidth}px viewport`
    );
  }
  for (const element of observation.overflowing) {
    const past = element.right - observation.viewportWidth;
    if (past <= EDGE_TOLERANCE) continue;
    add(
      'overflow',
      1,
      `overflow:${element.descriptor}`,
      `${where(element)} runs ${past}px past the right edge of the ${observation.viewportWidth}px viewport`
    );
  }

  /* 2 — tap targets */

  for (const control of observation.controls) {
    if (control.height < MIN_CONTROL_HEIGHT) {
      add(
        'tap-targets',
        2,
        `tap-height:${control.descriptor}`,
        `${where(control)} is ${control.height}px tall — a Button renders at 42px, so something has squashed this one`
      );
    }
    if (control.width < MIN_CONTROL_WIDTH) {
      add(
        'tap-targets',
        2,
        `tap-width:${control.descriptor}`,
        `${where(control)} is ${control.width}px wide, under the ${MIN_CONTROL_WIDTH}px a finger can reliably hit`
      );
    }
    if (control.clipped) {
      add(
        'tap-targets',
        2,
        `tap-clipped:${control.descriptor}`,
        `${where(control)} is narrower than its own label, so the label is cut off`
      );
    }
  }

  const ordered = [...observation.controls].sort((a, b) => a.left - b.left);
  for (let i = 0; i < ordered.length - 1; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i];
      const b = ordered[j];
      if (!sameRow(a, b)) continue;
      const gap = b.left - a.right;
      if (gap >= MIN_CONTROL_GAP) break;
      add(
        'tap-targets',
        2,
        `tap-gap:${a.descriptor}|${b.descriptor}`,
        gap < 0
          ? `${where(a)} and ${where(b)} overlap by ${-gap}px on the same row`
          : `${where(a)} and ${where(b)} sit ${gap}px apart on the same row, under the ${MIN_CONTROL_GAP}px minimum gap`
      );
      break;
    }
  }

  /* 3 — jargon, over what was actually painted */

  for (const term of SURFACE_JARGON_TERMS) {
    if (jargonPattern(term).test(observation.text)) {
      add(
        'no-jargon',
        6,
        `jargon:${term}`,
        `the word "${term}" is on screen — it describes how the app works, not what the member is doing`
      );
    }
  }

  return defects;
}

/* ------------------------------------------------------------------ */
/* Reporting                                                           */
/* ------------------------------------------------------------------ */

export interface GroupedDefect {
  check: PreviewDefectCheck;
  rubricCheck: number;
  key: string;
  message: string;
  cells: string[];
}

/**
 * One line per distinct defect, with every cell it was seen in named.
 *
 * A chart that overflows shows up in eight of the twelve cells. Printing it
 * eight times is how a defect list becomes a wall nobody reads, which is the
 * failure this whole mechanism is trying not to repeat one level up.
 */
export function groupDefects(defects: PreviewDefect[]): GroupedDefect[] {
  const byKey = new Map<string, GroupedDefect>();
  for (const defect of defects) {
    const existing = byKey.get(defect.key);
    if (existing) {
      if (!existing.cells.includes(defect.cell)) {
        existing.cells.push(defect.cell);
      }
      continue;
    }
    byKey.set(defect.key, {
      check: defect.check,
      rubricCheck: defect.rubricCheck,
      key: defect.key,
      message: defect.message,
      cells: [defect.cell],
    });
  }
  return [...byKey.values()].sort(
    (a, b) => a.rubricCheck - b.rubricCheck || a.key.localeCompare(b.key)
  );
}

/**
 * Printed on every run, defects or none.
 *
 * A machine pass that finds nothing and says nothing else reads as "the app is
 * fine", and that reading is false in a way that would make this feature worse
 * than not having it. Every line here is a check a model must still make with
 * its own eyes.
 */
export const PREVIEW_DEFECTS_NOT_CHECKED = [
  'whether any copy means anything, or answers what was asked (rubric checks 4, 5 and 7 are entirely yours)',
  'colour, contrast or dark-theme readability (check 3) — no colour is measured anywhere in this pass',
  'whether a tappable thing LOOKS tappable, or whether a bare count is really the control (check 2 is only measured as geometry)',
  'the rubric’s wider vocabulary list — "state", "action", "event", "host", "fold", "sandbox", "bundle" are legitimate words in a real app’s own domain, so only the gate’s six unambiguous terms are matched',
  'vertical crowding, spacing inside a control, or anything a chart draws that is not text',
  'whether the populated state resembles anything a real group would produce',
];
