import { Window } from 'happy-dom';

// The value imports below deliberately use deep subpaths instead of the
// package root. `bunfig.toml` preloads a process-wide
// `mock.module('@tloncorp/api', …)` for unit tests, and that mock does not
// carry the surface exports; a root import would resolve to it and fail ESM
// named-export validation. Subpaths resolve to the real modules, so the gate
// runs the SAME schemas, pointer parser and reducer the client runs — the
// shared-implementation rule from plan §6/§9. tsc cannot follow "exports"
// under moduleResolution:Node, hence the suppressions; the casts below
// restore the real types from the package's root declarations.
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceJsonPointerModule from '@tloncorp/api/client/surface/jsonPointer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceReducerModule from '@tloncorp/api/client/surface/reducer';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceSchemasModule from '@tloncorp/api/client/surface/schemas';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import { runShellFixture } from '@tloncorp/surface-shell/node';

import {
  type ControlRecorder,
  type HandlerErrorWatch,
  type ShellRun,
  MAX_ACTIVATION_CLICKS,
  activateControls,
  installDomGlobals,
  invokePost,
  plural,
  recordEventBindings,
  snapshotPost,
  watchHandlerErrors,
} from './surface-activation';
import {
  type ScannedBundle,
  type SurfaceSourceSpan,
  type SurfaceSpanKind,
  matchSpans,
  scanBundle,
} from './surface-bundle-scan';
import { canonicalJson } from './surface-canonical-json';

/**
 * The surface-channels publish gate (plan §9).
 *
 * A bundle + spec pair goes in; a machine-readable violation list comes out.
 * The consumer is the bot's self-repair loop, not a human, so every finding
 * carries a stable rule id and a line (bundle findings) or a spec path
 * (spec findings) — never prose the caller has to parse.
 *
 * Two kinds of check live here and the difference is load-bearing:
 *
 * - **Lexical** checks read the bundle's source through `scanBundle`, which
 *   separates code from strings, template markup and comments. They are the
 *   right tool where the property IS a property of the source text (module
 *   syntax, a forbidden identifier, an `href` in markup) and they are cheap
 *   enough to run on a bundle that cannot even be evaluated.
 * - **Behavioral** checks run the bundle through the REAL shell
 *   (`runShellFixture` from `@tloncorp/surface-shell/node`) and the REAL
 *   reducer (`reduceSurface` from `@tloncorp/api`), then inspect what
 *   actually happened. They are the right tool where source text is a poor
 *   proxy for behavior — canvas sizing (D58) and action idempotency (D54)
 *   are both cases where a grep false-positives on comments, is dodged by
 *   string concatenation, and still misses the thing that matters.
 *
 * Where both are available the behavioral one is primary and the lexical one
 * is a warning: see `chart-sizing` below.
 */

/* ------------------------------------------------------------------ */
/* Shared implementations, pulled in through subpaths                  */
/* ------------------------------------------------------------------ */

type ApiModule = typeof import('@tloncorp/api');

// The gate validates against the PUBLISHABLE schema, not the reader's (D198).
// A rule that refuses a shape already in the field belongs on the write path
// only; applied to reads it turns live boards `invalid` on upgrade.
const { SURFACE_CAPS, SurfaceSpecSchema, PublishableSurfaceSpecSchema } =
  surfaceSchemasModule as Pick<
    ApiModule,
    'SURFACE_CAPS' | 'SurfaceSpecSchema' | 'PublishableSurfaceSpecSchema'
  >;
const { reduceSurface } = surfaceReducerModule as Pick<
  ApiModule,
  'reduceSurface'
>;
const { parsePointer } = surfaceJsonPointerModule as Pick<
  ApiModule,
  'parsePointer'
>;

type SurfaceSpec = ApiModule['SurfaceSpecSchema']['_output'];

/* ------------------------------------------------------------------ */
/* Public shape                                                        */
/* ------------------------------------------------------------------ */

/**
 * Rule ids, in gate order (plan §9). The order is part of the contract: a
 * self-repair loop fixes the earliest violation first, because later rules
 * are frequently downstream of it (a bundle with module syntax cannot be
 * evaluated at all, so nothing behavioral can be said about it).
 */
export const SURFACE_LINT_RULES = [
  'byte-cap',
  'module-syntax',
  'external-reference',
  'forbidden-api',
  'navigation-vector',
  'entry-point',
  'undeclared-action',
  'pointer-hygiene',
  'spec-schema',
  'style',
  'chart-sizing',
  'jargon',
  'smoke-render',
  'action-idempotency',
  // Appended rather than filed beside the other spec rules on purpose: the
  // numbers in this list are cited by `RUBRIC.md`, `PARADIGM.md` and this
  // module's own comments ("rule 13 — idempotency"), and inserting in the
  // middle would renumber every rule after it. Ordering is a repair-priority
  // signal, and a warning is never the first thing to repair.
  'member-interaction',
  // Appended for the same reason `member-interaction` was: the numbers in
  // this list are cited by name elsewhere, so new rules go on the end.
  'time-display',
  // Appended for that same reason.
  'count-agreement',
  // Appended for that same reason. Catches the action the reducer refuses
  // on every path — declared, rendered, pressable, and incapable of ever
  // changing the board. See `checkInertActions` for why no existing rule
  // could see it.
  'inert-action',
] as const;

export type SurfaceLintRule = (typeof SURFACE_LINT_RULES)[number];

export type SurfaceLintSeverity = 'error' | 'warning';

export interface SurfaceLintViolation {
  rule: SurfaceLintRule;
  severity: SurfaceLintSeverity;
  message: string;
  /** 1-based line in the bundle source; absent for spec-only findings */
  line?: number;
  /** 1-based column in the bundle source */
  column?: number;
  /** dotted path into the spec, for spec-only findings */
  specPath?: string;
  /** the offending source text, trimmed and bounded */
  evidence?: string;
}

export interface SurfaceLintSkip {
  rule: SurfaceLintRule;
  reason: string;
}

export interface SurfaceLintResult {
  /** false when any `error` violation was reported */
  ok: boolean;
  /**
   * Set when the GATE ITSELF could not run — the harness could not render a
   * known-good bundle, so nothing the behavioral phase would have said about
   * the caller's app is worth anything.
   *
   * It exists because the alternative was measured and is worse than useless.
   * Run from the repo root rather than from `packages/tlon-skill`, bun
   * resolves a different tsconfig, preact's JSX runtime mismatches, and the
   * SHIPPED poll template fails with `render threw (initial state):
   * TypeError: Attempting to define property on object that is not
   * extensible` — reported as a `smoke-render` VIOLATION, i.e. as an author
   * error. This codebase's own error-class doctrine tells a bot that an author
   * error means "your files are wrong, rewrite and retry", so a correct app
   * gets regenerated because of the directory the tool was invoked from.
   *
   * Non-null means: report an ENVIRONMENT failure, change nothing about the
   * app, and do not treat any behavioral finding as a verdict.
   */
  environment: string | null;
  /** severity `error`, in rule order then source order */
  violations: SurfaceLintViolation[];
  /** severity `warning`; never affects `ok` */
  warnings: SurfaceLintViolation[];
  /** rules that could not run, with the reason they were skipped */
  skipped: SurfaceLintSkip[];
}

export interface SurfaceLintInput {
  /**
   * The bundle's source text. A bundle is JAVASCRIPT, not a document: the
   * sandbox assembler injects this inside a `<script>` tag and the harness
   * wraps it in a function, so markup here would never run. Plan §9 and the
   * SKILL draft say `surface lint app.html spec.json`, which is a plan
   * error — both shipped bundles are `.js`. The gate takes source text and
   * never a path, so it is extension-agnostic by construction.
   */
  bundleSource: string;
  /** the RAW parsed spec (JSON.parse output) — never a validated view */
  spec: unknown;
  /**
   * DOM window factory for the smoke render. Defaults to happy-dom, which
   * is what plan §9 specifies; injectable so a caller can supply a
   * different DOM (or a pre-warmed one) without this module growing a
   * second environment.
   */
  createWindow?: () => unknown;
  /**
   * Extra denylisted terms for the jargon rule, on top of the built-in D55
   * class. The list is expected to grow as new constraints teach models new
   * ways to narrate their own mechanism.
   */
  extraJargon?: readonly string[];
  /**
   * Extra plural nouns for the count-agreement rule, on top of
   * `SURFACE_COUNT_NOUNS`.
   *
   * The same escape hatch as `extraJargon` and for the same reason: the
   * built-in list is curated for precision, so the words it leaves out are a
   * decision rather than an oversight, and a caller who wants one back should
   * not have to fork the rule. It is also how the suite proves the quiet
   * result on the shipped templates is a property of the LIST — add `ways` and
   * `expense-split` fails on "split 1 ways", which is a real defect the
   * built-in list deliberately does not claim.
   */
  extraCountNouns?: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Rule constants                                                      */
/* ------------------------------------------------------------------ */

/**
 * D55's class: v0 constraints push a generating model to describe its own
 * mechanism accurately and ship the jargon. The gate cannot judge whether
 * copy reads well, but it can refuse the specific words that only exist
 * because of how surfaces are built.
 */
export const SURFACE_JARGON_TERMS = [
  'rollover',
  'revision',
  'invoke',
  'spec',
  'scratch',
  '$actor',
] as const;

/**
 * Plural count-nouns that must not follow a literal `1` in rendered copy.
 *
 * The class: an app builds a sentence out of a count and a noun —
 * `${claimShips.length} people active` — and never handles the one case where
 * English needs the singular. The board that shipped this rendered
 * **"1 people active"**, which is the whole reason this rule exists.
 *
 * An INCLUSION list, not a general `1 \w+s` pattern, and the shape is copied
 * from `SURFACE_JARGON_TERMS` above for the same reason that list is curated:
 * a copy rule that cries wolf gets switched off, and then it catches nothing
 * at all. A general plural pattern would fire on every singular noun that ends
 * in `s` ("1 status", "1 progress", "1 pass", "1 series", "1 bus") and would
 * still MISS the case that shipped, because "people" has no `s`.
 *
 * Each entry earns its place by being (a) a plural naming a thing a group
 * dashboard counts, and (b) unreadable as a verb after a bare number — which
 * is why `wins`, `sets`, `matches`, `notes`, `files` and `points` are absent
 * even though "1 wins" is just as wrong: "Week 1 wins by round" is a heading a
 * correct app could paint, and one false accusation costs more than one miss.
 */
export const SURFACE_COUNT_NOUNS = [
  'people',
  'members',
  'guests',
  'players',
  'votes',
  'tasks',
  'cards',
  'items',
  'entries',
  'responses',
  'options',
  'choices',
  'rounds',
  'columns',
  'dishes',
  'courses',
  'seats',
  'habits',
  'sessions',
  'days',
  'hours',
  'minutes',
  'weeks',
  'photos',
  'reps',
] as const;

/**
 * The v0 layout subset. Everything visual — color, type, elevation, radius —
 * belongs to the shell's primitives and tokens, so a bundle may position
 * things and nothing else (plan §5).
 */
export const SURFACE_STYLE_PROPERTY_ALLOWLIST: ReadonlySet<string> = new Set([
  'align-content',
  'align-items',
  'align-self',
  'aspect-ratio',
  'column-gap',
  'display',
  'flex',
  'flex-basis',
  'flex-direction',
  'flex-flow',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'gap',
  'grid-area',
  'grid-column',
  'grid-row',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'justify-content',
  'justify-items',
  'justify-self',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'order',
  'overflow',
  'overflow-x',
  'overflow-y',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'row-gap',
  'text-align',
  'width',
]);

/** Elements whose `href` is navigation, not a subresource reference. */
const ANCHOR_TAGS = new Set(['a', 'area']);

const REFERENCE_ATTRIBUTES = [
  'src',
  'srcset',
  'poster',
  'action',
  'formaction',
  'manifest',
  'href',
  'xlink:href',
];

/**
 * The synthetic identities the behavioral fold runs as. The host is only ever
 * compared for equality (it authors the stand-in migration snapshot), and the
 * actor is what `$actor` resolves to — deliberately a ship no real spec would
 * seed, so a fold that writes nothing is visible as a fold that wrote nothing.
 */
export const GATE_HOST_SHIP = '~zod';
export const GATE_ACTOR_SHIP = '~sampel-palnet';

/**
 * The host-supplied `now` the behavioral phase renders at: 2025-01-01T00:00:00Z,
 * the same instant `surface preview` captures at.
 *
 * FIXED, because every judgement in the behavioral phase is a comparison of two
 * renders (idempotency compares folds, activation compares before and after a
 * press), and a clock that moved between them would put a difference into every
 * one of those comparisons that has nothing to do with the app.
 */
export const GATE_NOW = Date.UTC(2025, 0, 1, 0, 0, 0);

/**
 * The offset the time-display probe advances `now` by: one day.
 *
 * A day rather than a second because the probe asks "does this screen depend
 * on the clock at all", and an app that renders a DATE — the commonest shape,
 * and the one a countdown has — changes over a day and not over a second. It
 * is deliberately not a year: a target date the host wrote is usually weeks
 * out, and an offset that jumps past every deadline in the fixture would make
 * a countdown and a finished countdown look like the same finding.
 */
export const GATE_NOW_PROBE_OFFSET_MS = 24 * 60 * 60 * 1000;

const EVIDENCE_MAX_LENGTH = 120;

/* ------------------------------------------------------------------ */
/* Collector                                                           */
/* ------------------------------------------------------------------ */

interface Collector {
  add(violation: SurfaceLintViolation): void;
  skip(rule: SurfaceLintRule, reason: string): void;
  readonly violations: SurfaceLintViolation[];
  readonly skipped: SurfaceLintSkip[];
}

function createCollector(): Collector {
  const violations: SurfaceLintViolation[] = [];
  const skipped: SurfaceLintSkip[] = [];
  return {
    violations,
    skipped,
    add(violation) {
      violations.push(violation);
    },
    skip(rule, reason) {
      skipped.push({ rule, reason });
    },
  };
}

function evidence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > EVIDENCE_MAX_LENGTH
    ? `${trimmed.slice(0, EVIDENCE_MAX_LENGTH)}…`
    : trimmed;
}

/* ------------------------------------------------------------------ */
/* Lexical rules                                                       */
/* ------------------------------------------------------------------ */

const CODE: readonly SurfaceSpanKind[] = ['code'];
// Copy and markup live in the same two span kinds, but the rules asking about
// them are asking different questions; the names keep the call sites honest.
const COPY: readonly SurfaceSpanKind[] = ['string', 'template-text'];
const MARKUP: readonly SurfaceSpanKind[] = ['string', 'template-text'];

function addSourceViolation(
  collector: Collector,
  scan: ScannedBundle,
  rule: SurfaceLintRule,
  severity: SurfaceLintSeverity,
  offset: number,
  message: string,
  text: string
): void {
  collector.add({
    rule,
    severity,
    message,
    line: scan.lineAt(offset),
    column: scan.columnAt(offset),
    evidence: evidence(text),
  });
}

/** Rule 1 — byte cap. */
function checkByteCap(collector: Collector, source: string): void {
  const bytes = new TextEncoder().encode(source).length;
  if (bytes > SURFACE_CAPS.bundleSize) {
    collector.add({
      rule: 'byte-cap',
      severity: 'error',
      message: `bundle is ${bytes} bytes; the cap is ${SURFACE_CAPS.bundleSize}`,
    });
  }
}

/**
 * Rule 2 — single plain script, no module syntax (D31). Dynamic `import(`
 * is deliberately NOT reported here: it is a forbidden API (rule 4), and
 * one violation per defect keeps the repair loop's fix unambiguous.
 */
function checkModuleSyntax(collector: Collector, scan: ScannedBundle): void {
  const patterns: { pattern: RegExp; message: string }[] = [
    {
      pattern: /(?<![\w$.])import\s*\.\s*meta\b/,
      message: 'import.meta is module syntax; bundles are plain scripts',
    },
    {
      // `import` must be its own token: `importScripts(` is rule 3's.
      pattern: /(?<![\w$.])import(?![\w$])\s*(?:[{*"']|[A-Za-z_$])/,
      message:
        'static import is module syntax; the shell exposes everything on `surface`',
    },
    {
      pattern: /(?<![\w$.])export\b/,
      message:
        'export is module syntax; a bundle is a plain script that calls surface.register()',
    },
  ];
  for (const { pattern, message } of patterns) {
    for (const found of matchSpans(scan, CODE, pattern)) {
      addSourceViolation(
        collector,
        scan,
        'module-syntax',
        'error',
        found.offset,
        message,
        found.match[0]
      );
    }
  }
}

/** The tag name owning an attribute match, read backwards from the match. */
function owningTag(spanText: string, index: number): string | null {
  const open = spanText.lastIndexOf('<', index);
  if (open === -1) {
    return null;
  }
  const name = /^<\s*\/?\s*([A-Za-z][\w-]*)/.exec(spanText.slice(open));
  return name === null ? null : name[1].toLowerCase();
}

function isInlineReference(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith('#') ||
    trimmed.toLowerCase().startsWith('data:')
  );
}

/**
 * Rule 3 — no external references. Markup and CSS reference targets only:
 * `fetch` and dynamic `import`, which plan §9 also lists under this
 * heading, are reported by rule 4 so a given defect names exactly one rule.
 * Anchors are rule 5's (navigation), not subresource loading.
 */
function checkExternalReferences(
  collector: Collector,
  scan: ScannedBundle
): void {
  const attributePattern = new RegExp(
    `(?:^|[\\s"'\`<])(${REFERENCE_ATTRIBUTES.join('|')})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    'i'
  );
  const skipsAsNavigation = (
    span: SurfaceSourceSpan,
    index: number,
    attribute: string
  ) =>
    attribute === 'href' &&
    (() => {
      const tag = owningTag(span.text, index);
      return tag !== null && ANCHOR_TAGS.has(tag);
    })();

  for (const found of matchSpans(scan, MARKUP, attributePattern)) {
    const attribute = found.match[1].toLowerCase();
    if (skipsAsNavigation(found.span, found.match.index, attribute)) {
      continue; // navigation, handled by rule 5
    }
    const value = found.match[2] ?? found.match[3] ?? '';
    if (isInlineReference(value)) {
      continue;
    }
    addSourceViolation(
      collector,
      scan,
      'external-reference',
      'error',
      found.offset,
      `${attribute} points outside the bundle (${evidence(value)}); bundles are self-contained`,
      found.match[0]
    );
  }

  // `src=${…}`: the template-text span STOPS at the interpolation, so the
  // attribute is only ever visible at the tail of a markup span.
  const interpolatedAttribute = new RegExp(
    `(?:^|[\\s"'\`<])(${REFERENCE_ATTRIBUTES.join('|')})\\s*=\\s*["']?$`,
    'i'
  );
  for (const span of scan.spans) {
    if (span.kind !== 'template-text') {
      continue;
    }
    const match = interpolatedAttribute.exec(span.text);
    if (match === null) {
      continue;
    }
    const attribute = match[1].toLowerCase();
    if (skipsAsNavigation(span, match.index, attribute)) {
      continue;
    }
    addSourceViolation(
      collector,
      scan,
      'external-reference',
      'error',
      span.start + match.index,
      `${attribute} is built at runtime and cannot be verified as inline; bundles are self-contained`,
      match[0]
    );
  }

  for (const found of matchSpans(scan, MARKUP, /@import\b/)) {
    addSourceViolation(
      collector,
      scan,
      'external-reference',
      'error',
      found.offset,
      'CSS @import pulls a stylesheet from outside the bundle',
      found.match[0]
    );
  }

  for (const found of matchSpans(
    scan,
    MARKUP,
    /\burl\(\s*(['"]?)([^'")]*)\1\s*\)/i
  )) {
    if (isInlineReference(found.match[2])) {
      continue;
    }
    addSourceViolation(
      collector,
      scan,
      'external-reference',
      'error',
      found.offset,
      `CSS url() points outside the bundle (${evidence(found.match[2])})`,
      found.match[0]
    );
  }

  for (const found of matchSpans(scan, CODE, /(?<![\w$])importScripts\s*\(/)) {
    addSourceViolation(
      collector,
      scan,
      'external-reference',
      'error',
      found.offset,
      'importScripts loads code from outside the bundle',
      found.match[0]
    );
  }
}

/**
 * Rule 16, lexical leg — the ambient clock, refused by name.
 *
 * `PARADIGM.md` §3 has said "No `Date`, no `Date.now()`, no
 * `setTimeout`/`setInterval`" since the paradigm was written, and until this
 * rule existed nothing enforced it: a bundle containing `Date.now() > 0 ? 0 :
 * 1` passed the gate clean, and so would one whose whole screen was a
 * per-viewer wall clock. A doctrine that asserts a guarantee nothing checks is
 * worse than one that admits the gap, because authors calibrate on it.
 *
 * The rule's other leg (`checkTimeDisplay`) is BEHAVIORAL and answers a
 * different question — does the painted output move when the host-supplied
 * clock does. Neither leg subsumes the other, and both are needed: the
 * behavioral leg cannot see a `Date` read whose painted result is stable over
 * a day, or one that never reaches the screen at all; this leg cannot see a
 * screen that moves with `context.now` without naming any banned identifier.
 * Same two-leg shape as rule 12 (jargon), for the same reason.
 *
 * **What it cannot catch, stated so nobody over-trusts it.** It is lexical, so
 * an aliased global (`const D = globalThis['Da' + 'te']`) walks past it, as
 * does any clock reached through a computed member expression. It does not ban
 * `Intl.DateTimeFormat`, which formats a host-supplied timestamp without
 * reading a clock — and which still renders per the VIEWER's timezone, so it
 * is a per-viewer display choice the same way theme is. Between the two legs
 * the ordinary ways of reading a clock are refused; a determined evasion is
 * not, and never was the claim.
 */
function checkAmbientTime(collector: Collector, scan: ScannedBundle): void {
  const patterns: { pattern: RegExp; message: string }[] = [
    {
      pattern: /(?<![\w$])Date\b/,
      message:
        'Date is forbidden: the sandbox clock is the VIEWER’s, so "today", "overdue" and elapsed time differ per member and the divergence is silent. Read the host-supplied clock from render’s second argument (`render(state, context)` → `context.now`) and declare timeDisplay, or use a date the host wrote into state',
    },
    {
      pattern: /(?<![\w$])(setTimeout|setInterval)\s*\(/,
      message:
        'setTimeout/setInterval are forbidden: a surface repaints when the host sends it something, never on a timer it started itself. A screen that must stay current declares timeDisplay and the host resends `now`',
    },
    {
      pattern: /(?<![\w$])(requestAnimationFrame|requestIdleCallback)\s*\(/,
      message:
        'requestAnimationFrame/requestIdleCallback are forbidden: render is a pure function of (state, context) called by the harness, and scheduling your own repaint is app-local state by another name',
    },
    {
      pattern: /(?<![\w$])performance\s*\.\s*now\s*\(/,
      message:
        'performance.now() is forbidden: it is the viewer’s clock with a different origin, and elapsed time is not something a surface may derive',
    },
  ];
  for (const { pattern, message } of patterns) {
    for (const found of matchSpans(scan, CODE, pattern)) {
      addSourceViolation(
        collector,
        scan,
        'time-display',
        'error',
        found.offset,
        message,
        found.match[0]
      );
    }
  }
}

/** Rule 4 — forbidden APIs. */
function checkForbiddenApis(collector: Collector, scan: ScannedBundle): void {
  const patterns: { pattern: RegExp; message: string }[] = [
    {
      pattern: /(?<![\w$])fetch\s*\(/,
      message: 'fetch() is forbidden: app code has no network access',
    },
    {
      pattern: /(?<![\w$])XMLHttpRequest\b/,
      message: 'XMLHttpRequest is forbidden: app code has no network access',
    },
    {
      pattern: /(?<![\w$])WebSocket\b/,
      message: 'WebSocket is forbidden: app code has no network access',
    },
    {
      pattern: /(?<![\w$])eval\s*\(/,
      message: 'eval() is forbidden',
    },
    {
      pattern: /(?<![\w$.])import\s*\(/,
      message:
        'dynamic import() is forbidden: bundles are single plain scripts',
    },
  ];
  for (const { pattern, message } of patterns) {
    for (const found of matchSpans(scan, CODE, pattern)) {
      addSourceViolation(
        collector,
        scan,
        'forbidden-api',
        'error',
        found.offset,
        message,
        found.match[0]
      );
    }
  }
}

/** True when any span of one of `kinds` matches `pattern`. */
function hasMatch(
  scan: ScannedBundle,
  kinds: readonly SurfaceSpanKind[],
  pattern: RegExp
): boolean {
  return matchSpans(scan, kinds, pattern).next().done !== true;
}

/**
 * Does the bundle bind `name` itself?
 *
 * A bare identifier the bundle declares is that declaration, not the global
 * of the same name — `function open(id)` in a modal, `const navigation = …`
 * in a router. The bare-identifier detectors below consult this, so the
 * rule's commonest firing stops being a false positive on ordinary app code.
 * The qualified forms (`window.open`, `window.navigation.navigate`) are
 * unaffected: a local declaration cannot shadow a property access.
 *
 * Lexical, therefore approximate in both directions — it does not scope, so
 * a declaration anywhere suppresses the bare form everywhere, and a bundle
 * that writes `const open = window.open` walks past it. That is the price of
 * the false-positive class this removes, and it is affordable precisely
 * because this rule is not a boundary (see `checkNavigationVectors`).
 */
function declaresBinding(scan: ScannedBundle, name: string): boolean {
  const patterns = [
    // function open(…) / async function* open(…)
    new RegExp(
      `(?<![\\w$])(?:async\\s+)?function\\s*\\*?\\s*${name}(?![\\w$])`
    ),
    // const/let/var open = …
    new RegExp(`(?<![\\w$])(?:const|let|var)\\s+${name}(?![\\w$])`),
    // { open() {…} } — method shorthand, and a class method
    new RegExp(`(?<![\\w$.])${name}\\s*\\([^()]*\\)\\s*\\{`),
    // { get open() {…} }
    new RegExp(`(?<![\\w$])(?:get|set)\\s+${name}\\s*\\(`),
    // const { open } = … / ({ open: go } = …)
    new RegExp(`\\{[^{}]*(?<![\\w$])${name}(?![\\w$])[^{}]*\\}\\s*=`),
  ];
  return patterns.some((pattern) => hasMatch(scan, CODE, pattern));
}

/**
 * The window-ish receivers a navigation global is reached through — the
 * dotted forms only. See `checkNavigationVectors` on why enumeration is the
 * ceiling here.
 *
 * ONE list, used by every receiver-shaped detector in the rule. It used to
 * be two: `location` read this list while `open` carried a hardcoded shorter
 * one, so `frames.open(…)` — and `frames` is `window`, so that is
 * `window.open` — walked past a rule that stopped `frames.location` cold.
 * Two lists in one function disagree the moment either is extended, which is
 * the failure this constant now exists to prevent.
 *
 * The last three are DOM-reached windows rather than globals:
 * `el.ownerDocument`, `document.defaultView` and `iframe.contentWindow` are
 * how ref-driven code arrives at the same objects, and none of them was
 * modeled. They are still a list, and still an incomplete one.
 */
const GLOBAL_RECEIVER =
  '(?:window|self|globalThis|top|parent|frames|document|ownerDocument|defaultView|contentWindow)';

/**
 * Any JS assignment operator, and never a comparison: `=`, `+=`, `||=`,
 * `??=`, `**=`, … but not `==`, `===`, `!=` or `>=`.
 *
 * Spelled generally on purpose. The markup-injection detector below used to
 * demand a BARE `=`, which let `el.innerHTML += markup` past — and
 * accumulating markup in a loop is the main reason to reach for `innerHTML`
 * at all, so the miss was on the commonest spelling rather than an exotic
 * one. Enumerating the compound operators one at a time would rot the same
 * way; matching the operator class does not.
 */
const ASSIGNMENT_OPERATOR =
  '(?:\\*\\*|<<|>>>|>>|\\|\\||&&|\\?\\?|[-+*/%&|^])?=(?!=)';

/** Members of the Navigation API that move the frame. */
const NAVIGATION_API_MEMBERS =
  '(?:navigate|reload|back|forward|traverseTo|updateCurrentEntry)';

/** Elements whose presence in the rendered DOM is a navigation route. */
const NAVIGATING_ELEMENTS = 'a[href], area[href], meta[http-equiv]';

/**
 * Rule 5 — navigation vectors. **A LINT, NOT A BOUNDARY.**
 *
 * What this is: a small set of source patterns that catch the naive and the
 * copied-off-the-shelf spellings of "make the frame load an outside
 * address", plus a behavioral half that reads the rendered DOM. That is
 * worth having — a bundle is usually written by a language model, and
 * generated code reaches for the obvious spelling — but it is the whole of
 * the claim. Two structural reasons it can never be containment, both
 * recorded and both reproduced against this file:
 *
 * - **It enumerates a capability set that is open.** Every lexical check
 *   below is a source pattern, and the platform keeps adding navigation
 *   surface: the Navigation API is modeled here only because an audit found
 *   it unmodeled — and found the sandbox-posture matrix does not probe it
 *   either — after a bundle calling `window.navigation.navigate()` from a
 *   click handler passed this gate clean while the request left the frame in
 *   Chromium. Keeping a list current is a maintenance liability, and a list
 *   is never a proof.
 * - **Property access is not a lexical property of source.**
 *   `window["loc" + "ation"]`, `Reflect.get(window, 'location')`,
 *   `document.defaultView[…]`, an alias through a local, a getter, a unicode
 *   escape inside the identifier: the matcher and the JS parser disagree
 *   about what the expression resolves to, and every one of those spellings
 *   passes this rule clean today. Measured against this file on the audit's
 *   own probe batch — 1 of 18 spellings caught before this leg was written,
 *   5 of 18 after — not assumed.
 *
 * Both reasons keep applying to the widenings this round made. Three
 * spellings that passed clean were closed — `innerHTML +=` and its compound
 * siblings, `frames.open(…)`, and `location`/`open` reached through
 * `ownerDocument` / `defaultView` / `contentWindow` — and closing them
 * lengthened a list rather than replacing one. The BRACKET forms of the
 * same reads (`el["innerHTML"] = …`, `document.defaultView["location"]`)
 * still pass, and are deliberately left: they are the second reason above,
 * not the first, and no amount of pattern work reaches them.
 *
 * Where containment actually comes from on web: **pre-flight**, the host
 * page's `frame-src` allowlist, which blocks the sandbox frame's
 * self-navigation on chromium, firefox and webkit before the request leaves
 * the device (D43). It SHIPS ENFORCING: `ENFORCE_HOST_CSP` is `true`
 * (`apps/tlon-web/hostCsp.ts`), so the "written-but-disabled" this comment
 * used to claim is two sessions stale (D171). D43's redirect residual is
 * also now measured and closed on all three engines. And **structurally**,
 * the M4 Worker-realm migration, which removes the
 * browsing context there is nothing here to navigate (D36, plan §5).
 * `packages/surface-shell/src/sandbox/document.ts` already states that
 * position for the in-realm hardening it ships; this rule is under the same
 * sentence. Nothing in the gate substitutes for either.
 */
function checkNavigationVectors(
  collector: Collector,
  scan: ScannedBundle
): void {
  const codePatterns: { pattern: RegExp; message: string }[] = [
    {
      // The BARE `location` identifier is deliberately NOT matched.
      // `wrapBundleSource` (`surface-shell/src/sandbox/document.ts`) shadows
      // it inside the bundle's own scope with an inert stand-in, so the bare
      // form navigates nothing in production — while `location` is an
      // ordinary field name for a potluck, a meetup or an event app, which
      // made this the rule's commonest firing and a false one. The member
      // form is what reaches the real, unforgeable Location (D45), and it is
      // what the posture matrix measures as NOT blocked.
      pattern: new RegExp(
        `(?<![\\w$])${GLOBAL_RECEIVER}\\s*\\.\\s*location\\b`
      ),
      message:
        'a member `location` reaches the real Location object, which no in-realm shim can take away; navigating the frame is egress the sandbox cannot block',
    },
    {
      pattern: /(?<![\w$])document\s*\.\s*write(?:ln)?\s*\(/,
      message: 'document.write can rewrite the frame into unpinned markup',
    },
    {
      pattern: new RegExp(
        `(?<![\\w$])${GLOBAL_RECEIVER}\\s*\\.\\s*open\\s*\\(`
      ),
      message:
        "a window-ish `open()` is a navigation vector; on `document` it is `document.write`'s stream form, which rewrites the frame into unpinned markup",
    },
    {
      pattern: new RegExp(
        `(?<![\\w$])${GLOBAL_RECEIVER}\\s*\\.\\s*navigation\\s*\\.\\s*${NAVIGATION_API_MEMBERS}\\s*\\(`
      ),
      message:
        'the Navigation API navigates the frame without ever touching `location`; it is egress the sandbox cannot block',
    },
    {
      // The imperative markup routes: the `document.write` trick spelled
      // without `document.write`. Whatever goes in is markup the lexical
      // scan never separated into spans, so a meta refresh or an anchor
      // inside it is invisible to every pattern above.
      //
      // Any assignment operator, not a bare `=`: `innerHTML += row` is how
      // markup actually gets accumulated. Reading the property is untouched
      // — `a.innerHTML === b.innerHTML` injects nothing — which is what the
      // negative lookahead inside `ASSIGNMENT_OPERATOR` protects.
      pattern: new RegExp(
        `(?<![\\w$])(?:inner|outer)HTML\\s*${ASSIGNMENT_OPERATOR}` +
          `|(?<![\\w$])insertAdjacentHTML\\s*\\(`
      ),
      message:
        'assigning innerHTML/outerHTML or calling insertAdjacentHTML injects markup no rule scanned; apps compose primitives and never assemble markup by hand',
    },
  ];

  // Bare-identifier detectors, suppressed when the bundle binds the name
  // itself: `open` is a modal/accordion/drawer verb and `navigation` is a
  // router object, and both are ordinary app vocabulary.
  if (!declaresBinding(scan, 'open')) {
    codePatterns.push({
      pattern: /(?<![\w$.])open\s*\(/,
      message:
        'open() with no local binding of that name is window.open, a navigation vector',
    });
  }
  if (!declaresBinding(scan, 'navigation')) {
    codePatterns.push({
      pattern: new RegExp(
        `(?<![\\w$.])navigation\\s*\\.\\s*${NAVIGATION_API_MEMBERS}\\s*\\(`
      ),
      message:
        'the Navigation API navigates the frame without ever touching `location`; it is egress the sandbox cannot block',
    });
  }
  for (const { pattern, message } of codePatterns) {
    for (const found of matchSpans(scan, CODE, pattern)) {
      addSourceViolation(
        collector,
        scan,
        'navigation-vector',
        'error',
        found.offset,
        message,
        found.match[0]
      );
    }
  }

  // `createElement("a")`: the tag name is its own string span, so the call
  // and its argument never share one — read the argument off the next span.
  scan.spans.forEach((span, index) => {
    if (span.kind !== 'code') {
      return;
    }
    const call = /(?<![\w$])createElement\s*\(\s*$/.exec(span.text);
    if (call === null) {
      return;
    }
    const argument = scan.spans[index + 1];
    if (argument?.kind !== 'string') {
      return;
    }
    if (!ANCHOR_TAGS.has(argument.text.slice(1, -1).toLowerCase())) {
      return;
    }
    addSourceViolation(
      collector,
      scan,
      'navigation-vector',
      'error',
      span.start + call.index,
      'a synthesized anchor is a navigation vector',
      `${call[0]}${argument.text}`
    );
  });

  const markupPatterns: { pattern: RegExp; message: string }[] = [
    {
      pattern: /<meta\b[^>]*http-equiv\s*=\s*['"]?refresh/i,
      message: 'meta refresh navigates the frame',
    },
    {
      // `area` rides with `a` deliberately: rule 3 SKIPS an `href` on both
      // tags as "navigation, handled by rule 5", and until this alternation
      // existed `<area href="https://…">` was handled by neither — it passed
      // the whole gate clean. `ANCHOR_TAGS` is the same pair, and the
      // `createElement` detector above already used it.
      pattern: /<(?:a|area)\b[^>]*\bhref\b/i,
      message:
        'anchor-driven navigation is forbidden; surfaces have no links out',
    },
  ];
  for (const { pattern, message } of markupPatterns) {
    for (const found of matchSpans(scan, MARKUP, pattern)) {
      addSourceViolation(
        collector,
        scan,
        'navigation-vector',
        'error',
        found.offset,
        message,
        found.match[0]
      );
    }
  }

  // `<a ...${{ href: … }}>`: htm's spread form supplies the attributes from
  // an object, so no attribute NAME appears in the markup and the patterns
  // above see only `<a `. Same shape as rule 3's interpolated-attribute
  // sweep — the template-text span stops at the `${`, so the spread is only
  // ever visible at the tail of a span.
  const spreadOnNavigatingTag = /<(a|area|meta)\b[^>]*\.\.\.\s*$/i;
  for (const span of scan.spans) {
    if (span.kind !== 'template-text') {
      continue;
    }
    const match = spreadOnNavigatingTag.exec(span.text);
    if (match === null) {
      continue;
    }
    addSourceViolation(
      collector,
      scan,
      'navigation-vector',
      'error',
      span.start + match.index,
      `<${match[1].toLowerCase()}> is built with spread attributes, so whether it navigates cannot be read from the source`,
      match[0]
    );
  }
}

/**
 * Rule 5's behavioral half: the navigating elements the app actually put in
 * the DOM, read after every render pass and after the controls are
 * activated.
 *
 * This is the better oracle of the two. A lexical pattern asks how the
 * markup was SPELLED; this asks what was BUILT, so an anchor assembled from
 * a spread prop, from a runtime string, or inside a click handler is caught
 * without the assembly route being one this file models. It is still not a
 * boundary — the DOM it reads is happy-dom's, reached only by the paths the
 * gate managed to activate.
 */
function checkNavigationInRendered(
  collector: Collector,
  seen: Set<string>,
  root: ShellRun['root'],
  when: string
): void {
  const nodes = root.querySelectorAll(NAVIGATING_ELEMENTS);
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const target =
      node.getAttribute('href') ?? node.getAttribute('content') ?? '';
    const equiv = node.getAttribute('http-equiv');
    if (equiv !== null && equiv.trim().toLowerCase() !== 'refresh') {
      continue;
    }
    const key = `nav-dom:${equiv ?? 'href'}:${target}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    collector.add({
      rule: 'navigation-vector',
      severity: 'error',
      message: `the rendered output (${when}) contains an element that navigates the frame (${evidence(target)}); surfaces have no links out`,
    });
  }
}

/**
 * Rule 6 — entry-point shape (D31): one plain script whose only entry is
 * `surface.register({ render })`. The lexical half is presence and
 * uniqueness; the behavioral half is the shell reporting an `init`-phase
 * error when what was registered is not an object with `render`.
 */
function checkEntryPoint(collector: Collector, scan: ScannedBundle): void {
  const registrations = [
    ...matchSpans(scan, CODE, /(?<![\w$])surface\s*\.\s*register\s*\(/),
  ];
  if (registrations.length === 0) {
    collector.add({
      rule: 'entry-point',
      severity: 'error',
      message:
        'bundle never calls surface.register({ render }); nothing would render',
    });
    return;
  }
  if (registrations.length > 1) {
    for (const found of registrations.slice(1)) {
      addSourceViolation(
        collector,
        scan,
        'entry-point',
        'error',
        found.offset,
        'bundle registers more than once; a surface has exactly one render',
        found.match[0]
      );
    }
  }
}

/** Rule 7 — every literal invoke() argument names a declared action. */
function checkActionCrossReference(
  collector: Collector,
  scan: ScannedBundle,
  declaredActions: readonly string[]
): void {
  const declared = new Set(declaredActions);
  // The literal argument is its own `string` span, so the call and its id
  // never sit in one span: find the call at the tail of a code span and read
  // the id off the span that follows.
  scan.spans.forEach((span, index) => {
    if (span.kind !== 'code') {
      return;
    }
    const pattern = /(?<![\w$])invoke\s*\(\s*/g;
    let match = pattern.exec(span.text);
    while (match !== null) {
      const offset = span.start + match.index;
      const rest = span.text.slice(match.index + match[0].length);
      if (rest.length === 0) {
        const argument = scan.spans[index + 1];
        const literal =
          argument?.kind === 'string' ? argument.text.slice(1, -1) : undefined;
        if (literal === undefined) {
          reportComputedInvoke(collector, scan, offset, match[0]);
        } else if (!declared.has(literal)) {
          addSourceViolation(
            collector,
            scan,
            'undeclared-action',
            'error',
            offset,
            `invoke("${literal}") references an action the spec does not declare`,
            `${match[0]}${argument.text}`
          );
        }
      } else if (!rest.startsWith(')')) {
        reportComputedInvoke(collector, scan, offset, match[0]);
      }
      match = pattern.exec(span.text);
    }
  });
}

function reportComputedInvoke(
  collector: Collector,
  scan: ScannedBundle,
  offset: number,
  text: string
): void {
  addSourceViolation(
    collector,
    scan,
    'undeclared-action',
    'warning',
    offset,
    'invoke() argument is computed; it cannot be cross-referenced against the spec',
    text
  );
}

/* ------------------------------------------------------------------ */
/* Spec rules                                                          */
/* ------------------------------------------------------------------ */

/**
 * Is `path` the spec path `root`, or something inside it?
 *
 * A spec path is dotted segments with `[n]` for array indices, so the only
 * things that can follow a complete segment are `.` and `[`. Comparing raw
 * prefixes instead makes every action whose id extends another id look like a
 * child of it.
 */
export function specPathIsUnder(
  path: string | undefined,
  root: string
): boolean {
  if (path === undefined) return false;
  if (path === root) return true;
  if (!path.startsWith(root)) return false;
  const next = path[root.length];
  return next === '.' || next === '[';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface RawAction {
  id: string;
  ops: Record<string, unknown>[];
  duplicatesTolerated: boolean;
}

/**
 * Reads actions off the RAW spec.
 *
 * `duplicatesTolerated` is now a declared optional field on
 * `SurfaceActionSchema` (`packages/api/src/client/surface/schemas.ts`), so
 * it survives validation and this raw read is no longer the only thing
 * keeping the marker alive — it is defence in depth, not load-bearing.
 *
 * It stays raw anyway because the gate must judge the spec it was HANDED,
 * including one that fails validation outright: a spec the schema rejects
 * still has to produce violations naming the real defect rather than
 * vanishing into an empty action list.
 */
function readRawActions(spec: unknown): RawAction[] {
  if (!isRecord(spec) || !isRecord(spec.actions)) {
    return [];
  }
  const actions: RawAction[] = [];
  for (const id of Object.keys(spec.actions)) {
    const action = spec.actions[id];
    if (!isRecord(action)) {
      continue;
    }
    const ops = Array.isArray(action.ops) ? action.ops.filter(isRecord) : [];
    actions.push({
      id,
      ops,
      duplicatesTolerated: action.duplicatesTolerated === true,
    });
  }
  return actions;
}

/**
 * The value `memberInteraction.mode` takes when an app is display-only by
 * design.
 *
 * An enum with one legal value, not a boolean, and the distinction is the
 * naming argument. A boolean (`displayOnly: true`) creates a third state the
 * schema cannot refuse — `displayOnly: false` over an empty action map is a
 * spec asserting members can act and declaring nothing they can do — and it
 * describes the SCREEN, which is wrong: a display-only surface still changes,
 * from host events (a countdown ticks, a schedule advances). What is empty is
 * the MEMBER's half of the action map, and that is what this names.
 */
const MEMBER_INTERACTION_NONE = 'none';

/**
 * Whether the spec declares itself display-only, in the form that counts.
 *
 * A bare marker does not. The first app to carry `memberInteraction` was the
 * expense split this rule was written to catch, declared inert and shipped
 * inert one session after the failure was named — the marker copied out of the
 * doctrine's snippet before any lint ran. So the marker costs a sentence, and
 * a marker without one silences nothing: the warning still fires, and it says
 * what is missing.
 */
function declaresDisplayOnly(spec: Record<string, unknown>): {
  marked: boolean;
  because: string | null;
} {
  const marker = spec.memberInteraction;
  if (!isRecord(marker)) return { marked: false, because: null };
  if (marker.mode !== MEMBER_INTERACTION_NONE) {
    return { marked: false, because: null };
  }
  const because = marker.because;
  return {
    marked: true,
    because:
      typeof because === 'string' && because.trim() !== ''
        ? because.trim()
        : null,
  };
}

/**
 * Rule 15 — an inert app is a declared choice, not a silent one.
 *
 * Both 6a.5 "who owes what" apps shipped with `actions: {}` — a beach-trip
 * expense split no member can add an expense to. Every gate rule passed
 * (there is nothing wrong with the bundle) and rubric check 7 passed too:
 * "the screen is the thing that was asked for" is scored against a
 * screenshot, and a screenshot of a board nobody can touch looks exactly
 * like a screenshot of a board somebody can.
 *
 * So the gate says it out loud. WARNING, never a violation: a display-only
 * surface is a legitimate shape (a countdown, a schedule, a read-only
 * summary) and refusing it would be refusing the shape rather than the
 * silence. Declaring `memberInteraction: "none"` is the whole opt-out, and
 * it passes clean — the same move `duplicatesTolerated` makes for D54.
 *
 * Read off the RAW spec, like every other spec rule here: the gate judges
 * the spec it was handed.
 */
function checkMemberInteraction(collector: Collector, spec: unknown): void {
  // A non-object spec has a `spec-schema` violation of its own; this rule has
  // nothing to add to it.
  if (!isRecord(spec)) return;
  const actionCount = isRecord(spec.actions)
    ? Object.keys(spec.actions).length
    : 0;
  if (actionCount > 0) return;
  const { marked, because } = declaresDisplayOnly(spec);
  if (marked && because !== null) return;
  collector.add({
    rule: 'member-interaction',
    severity: 'warning',
    message: marked
      ? 'the spec declares memberInteraction.mode "none" but gives no "because", so nothing on the record says what moves this app\'s state instead. Name the host event — "the bot posts the day\'s rollover each morning", "the launch date is fixed at creation". If you cannot name one, the app is not display-only and it is missing the action its request asked for.'
      : 'the spec declares no actions, so no member can change anything on this surface. If that is the app — a countdown, a schedule, a read-only summary — declare memberInteraction: {"mode": "none", "because": "<what moves the state instead>"} and this warning goes away. If it is not, the app is missing the action its request asked for.',
    specPath: marked ? 'memberInteraction' : 'actions',
  });
}

/**
 * Rule 8 — pointer hygiene (D51). `~` is RFC 6901's escape character, so a
 * ship used as a path SEGMENT must be written `~0zod`; a bare `~z` is an
 * invalid escape and the reducer silently skips the op. Only `path` is
 * inspected: the same ship as an object KEY INSIDE A VALUE is bare and
 * correct, and flagging that would be a false positive on every spec that
 * seeds per-user state.
 */
function checkPointerHygiene(
  collector: Collector,
  rawActions: readonly RawAction[]
): void {
  for (const action of rawActions) {
    action.ops.forEach((op, index) => {
      if (typeof op.path !== 'string') {
        return;
      }
      const parsed = parsePointer(op.path);
      if (parsed.ok) {
        return;
      }
      const hint = /invalid escape/.test(parsed.error)
        ? ' — a ship in a path segment must be RFC 6901-escaped (~0zod), though the same ship as an object key inside a value stays bare'
        : '';
      collector.add({
        rule: 'pointer-hygiene',
        severity: 'error',
        message: `op path "${op.path}" is not a valid surface pointer: ${parsed.error}${hint}`,
        specPath: `actions.${action.id}.ops[${index}].path`,
      });
    });
  }
}

/** Rule 9 — spec schema, including every §7 cap, via the shared Zod. */
function checkSpecSchema(
  collector: Collector,
  spec: unknown
): SurfaceSpec | null {
  // The gate is the write path, so it holds the spec to the publishable
  // rules — which are the reader's plus the ones that would be retroactive if
  // a reader applied them (D198).
  const result = PublishableSurfaceSpecSchema.safeParse(spec);
  if (result.success) {
    return result.data;
  }
  for (const issue of result.error.issues) {
    collector.add({
      rule: 'spec-schema',
      severity: 'error',
      message: `${issue.message} [${issue.code}]`,
      specPath: issue.path.length > 0 ? issue.path.join('.') : '<root>',
    });
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Style rule                                                          */
/* ------------------------------------------------------------------ */

const COLOR_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /#[0-9a-fA-F]{3,8}\b/, label: 'hex color literal' },
  { pattern: /\brgba?\s*\(/, label: 'rgb()/rgba() literal' },
  { pattern: /\bhsla?\s*\(/, label: 'hsl()/hsla() literal' },
];

function kebab(property: string): string {
  return property
    .trim()
    .replace(/['"]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function lintDeclarations(
  collector: Collector,
  scan: ScannedBundle,
  offset: number,
  declarations: string,
  origin: string
): void {
  for (const chunk of declarations.split(';')) {
    const separator = chunk.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const property = kebab(chunk.slice(0, separator));
    // At-rules (`@import url('https://…')`) and anything else that is not a
    // property name are not declarations; the colon in a URL would otherwise
    // read as one and report a nonsense property.
    if (!/^-?[a-z][a-z0-9-]*$/.test(property)) {
      continue;
    }
    if (!SURFACE_STYLE_PROPERTY_ALLOWLIST.has(property)) {
      addSourceViolation(
        collector,
        scan,
        'style',
        'error',
        offset,
        `${origin} sets "${property}", which is outside the layout subset apps may style`,
        chunk
      );
    }
  }
}

/**
 * Rule 10 — style lint. Apps compose primitives and tokens; they do not pick
 * type, color, or anything outside the layout subset (plan §5). The color
 * and font sweeps mirror `packages/surface-shell/scripts/check-styles.mjs`,
 * which cannot be reused directly: that script walks shell SOURCE, and a
 * bundle is not shell source.
 */
function checkStyles(collector: Collector, scan: ScannedBundle): void {
  for (const found of matchSpans(
    scan,
    COPY,
    /font-family\s*:(?!\s*var\(--)/i
  )) {
    addSourceViolation(
      collector,
      scan,
      'style',
      'error',
      found.offset,
      "font-family is not the app's to choose; type comes from the shell tokens",
      found.match[0]
    );
  }
  for (const { pattern, label } of COLOR_PATTERNS) {
    for (const found of matchSpans(scan, COPY, pattern)) {
      addSourceViolation(
        collector,
        scan,
        'style',
        'error',
        found.offset,
        `${label} is not a design token; colors come from var(--…)`,
        found.match[0]
      );
    }
  }

  // style="…" attributes and <style> blocks in markup
  for (const found of matchSpans(
    scan,
    MARKUP,
    /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i
  )) {
    lintDeclarations(
      collector,
      scan,
      found.offset,
      found.match[1] ?? found.match[2] ?? '',
      'style attribute'
    );
  }
  for (const found of matchSpans(
    scan,
    MARKUP,
    /<style\b[^>]*>([\s\S]*?)<\/style>/i
  )) {
    const body = found.match[1].replace(/[^{]*\{/g, ';').replace(/\}/g, ';');
    lintDeclarations(collector, scan, found.offset, body, '<style> block');
  }

  // style=${{ … }} object literals: the htm form of the same thing. The
  // markup span ends at the `${`, so the object is read out of the raw
  // source that follows it rather than out of a span.
  for (const found of matchSpans(scan, MARKUP, /\bstyle\s*=\s*$/i)) {
    const objectStart = found.span.end;
    const objectSource = scan.source.slice(objectStart, objectStart + 400);
    const braced = /^\$\{\s*\{([^}]*)\}/.exec(objectSource);
    if (braced === null) {
      continue;
    }
    lintDeclarations(
      collector,
      scan,
      objectStart,
      braced[1].replace(/,/g, ';'),
      'style object'
    );
  }
}

/* ------------------------------------------------------------------ */
/* Jargon rule                                                         */
/* ------------------------------------------------------------------ */

function jargonPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return term.startsWith('$')
    ? new RegExp(`(?<![\\w$])${escaped}(?![\\w])`, 'i')
    : new RegExp(`(?<![\\w$])${escaped}(?![\\w])`, 'i');
}

/**
 * Rule 12 — jargon denylist (D55). Comments are deliberately out of scope:
 * a note to the next author is not copy a member reads. The lexical half
 * covers strings the initial state never reaches; the behavioral half reads
 * what the smoke render actually put on screen.
 */
function checkJargonLexically(
  collector: Collector,
  scan: ScannedBundle,
  terms: readonly string[]
): void {
  for (const term of terms) {
    for (const found of matchSpans(scan, COPY, jargonPattern(term))) {
      addSourceViolation(
        collector,
        scan,
        'jargon',
        'error',
        found.offset,
        `"${term}" is mechanism vocabulary; say what the member sees, not how it works`,
        found.match[0]
      );
    }
  }
}

function checkJargonInRendered(
  collector: Collector,
  seen: Set<string>,
  terms: readonly string[],
  renderedText: string,
  when: string
): void {
  for (const term of terms) {
    const pattern = jargonPattern(term);
    if (pattern.test(renderedText) && !seen.has(`jargon:${term}`)) {
      seen.add(`jargon:${term}`);
      collector.add({
        rule: 'jargon',
        severity: 'error',
        message: `rendered copy (${when}) contains "${term}", which is mechanism vocabulary`,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Count-agreement rule                                                */
/* ------------------------------------------------------------------ */

/**
 * `1` and a plural noun in the same run of copy.
 *
 * The pattern, exactly:
 *
 * - `(?<![\w.])` — the `1` must not continue a word or a decimal, so `31
 *   people` and `0.1 people` and `v1 people` are all left alone. Start of the
 *   run satisfies it, which is where the shipped defect sits.
 * - `1` — the literal one, and only one. `0 people` is correct English and
 *   `2 person` is the mirror error, which is rarer than this one and would
 *   need its own singular-noun list to find.
 * - one or more spaces (ordinary or non-breaking).
 * - the noun, from `SURFACE_COUNT_NOUNS`, case-insensitively.
 * - `(?![\w])` — so `1 peoples` is not reported as `1 people`.
 *
 * Behavioral only. There is no lexical leg because the source never contains
 * the defect: what is written is `${n} people`, and the string `1 people`
 * appears nowhere until something renders it. That is also what makes the rule
 * cheap to trust — it reports a thing that was on screen, quoted.
 *
 * It deliberately does NOT catch: a `Stat` whose value is `1` and whose label
 * is plural (see `renderedCopyRuns` — that is dashboard idiom and three
 * templates use it); a plural noun outside the list; an irregular plural
 * outside the list; `1` and its noun split across two elements by the app
 * itself; and any disagreement at a count other than one.
 */
function checkCountAgreementInRendered(
  collector: Collector,
  seen: Set<string>,
  nouns: readonly string[],
  runs: readonly string[],
  when: string
): void {
  for (const noun of nouns) {
    const pattern = new RegExp(`(?<![\\w.])1[ \\u00a0]+${noun}(?![\\w])`, 'i');
    for (const run of runs) {
      const found = pattern.exec(run);
      if (found === null || seen.has(`count-agreement:${noun}`)) {
        continue;
      }
      seen.add(`count-agreement:${noun}`);
      collector.add({
        rule: 'count-agreement',
        severity: 'error',
        message:
          `rendered copy (${when}) reads "${found[0]}" — a count of one against a plural noun. ` +
          `Pick the word from the number: \`n === 1 ? 'person' : 'people'\``,
        evidence: run.length > 120 ? `${run.slice(0, 117)}…` : run,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Behavioral phase                                                    */
/* ------------------------------------------------------------------ */

/**
 * A chart the gate can interrogate. This is the LIVE INSTANCE, never the
 * config it was constructed with: `options` is read at check time, so a
 * bundle that constructs responsively and then reassigns `chart.options`
 * reads as what it ended up being AS OF THAT READ. Reading the saved
 * constructor config instead is the defect this shape exists to remove —
 * that oracle passed a bundle whose chart was non-responsive on screen.
 *
 * "As of that read" is the whole of the claim, and it is load-bearing: the
 * reads all happen on the gate's synchronous stack, so a reassignment the
 * app defers to a microtask or a timer lands after the last one and is not
 * seen. `checkChartSizing` carries the measurement and why draining does
 * not fix it.
 */
interface LiveChart {
  options: unknown;
  destroyed: boolean;
}

function createRecordingChart(live: LiveChart[]): unknown {
  return class RecordingChart implements LiveChart {
    static defaults = {
      color: undefined as unknown,
      borderColor: undefined as unknown,
      font: { family: undefined as unknown },
    };

    data: unknown;
    options: unknown;
    destroyed = false;

    constructor(
      _canvas: unknown,
      config: { data?: unknown; options?: Record<string, unknown> }
    ) {
      live.push(this);
      this.data = config.data;
      this.options = config.options;
    }

    update(): void {}

    // The primitive tears an instance down when it leaves the tree; a torn
    // down chart is not on screen and must not be reported.
    destroy(): void {
      this.destroyed = true;
    }
  };
}

function renderedCopy(root: ShellRun['root']): string {
  const attributes = ['aria-label', 'title', 'placeholder', 'alt'];
  const parts: string[] = [root.textContent ?? ''];
  const nodes = root.querySelectorAll('*');
  for (let index = 0; index < nodes.length; index++) {
    for (const attribute of attributes) {
      const value = nodes[index].getAttribute(attribute);
      if (value !== null) {
        parts.push(value);
      }
    }
  }
  return parts.join(' ');
}

/**
 * The rendered copy split into the RUNS the app actually wrote — one per
 * element that has no element children, plus each copy-bearing attribute.
 *
 * `renderedCopy` above concatenates the whole tree, which is right for the
 * jargon rule (a denylisted word is a word wherever it sits) and wrong for any
 * rule that reads two adjacent tokens. Whole-tree `textContent` glues siblings
 * with no separator: the board this file's count rule was written about paints
 * `…update the shared board.` in one `div` and `1 people active` in the next,
 * and the glued string is `…shared board.1 people active`, where the match is
 * hidden behind a full stop. Glue in the other direction INVENTS matches —
 * a `v1` ending one element and ` people are here` beginning the next reads as
 * "1 people" and no element on screen says any such thing.
 *
 * Leaf elements are also exactly the line between prose and a stat block. The
 * shell's `Stat` primitive paints its value and its label in two separate
 * spans (`tsh-stat-value`, `tsh-stat-label`), so "1" over "votes so far" never
 * becomes one run — which is the intended reading: a stat label is a category
 * name that stays plural, the way every dashboard writes it, and three of the
 * shipped templates rely on that. A count and a noun in ONE run is the app
 * writing a sentence, and a sentence has to agree.
 */
function renderedCopyRuns(root: ShellRun['root']): string[] {
  const attributes = ['aria-label', 'title', 'placeholder', 'alt'];
  const runs: string[] = [];
  const nodes = root.querySelectorAll('*');
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index] as unknown as {
      children: { length: number };
      textContent: string | null;
      getAttribute(name: string): string | null;
    };
    if (node.children.length === 0) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        runs.push(text);
      }
    }
    for (const attribute of attributes) {
      const value = node.getAttribute(attribute);
      if (value !== null) {
        runs.push(value);
      }
    }
  }
  return runs;
}

/**
 * Rule 11 — canvas/chart sizing, BEHAVIORAL (plan §9, D58).
 *
 * This is the primary check and it has to be: `surface.Chart` stays exposed
 * as an escape hatch, so the broken shape — a fixed-pixel canvas with
 * `responsive: false` — remains writable, and a `new Chart(` source grep
 * both false-positives on comments and is dodged by concatenation. What
 * cannot be dodged is the rendered DOM and what a live chart's options say
 * WHEN READ, which is exactly what both early bundles got wrong. The source
 * grep survives only as a warning layer.
 *
 * Two oracles, and the difference between them is load-bearing:
 *
 * - **The live instance.** `options.responsive` / `options.maintainAspectRatio`
 *   are read off the chart OBJECT at check time — after the render pass and
 *   after the declared actions' controls have been activated. It therefore
 *   sees a chart built inside a click handler, and it sees
 *   `chart.options = { responsive: false }` after a responsive
 *   construction. Reading the saved constructor config instead passed both
 *   of those clean, which is the defect this shape exists to remove.
 * - **The canvas attributes**, which are a NARROWER claim than the doctrine
 *   has been making. In this environment a `width`/`height` attribute on a
 *   canvas was put there by the bundle, because the gate substitutes a
 *   recording stand-in that never touches the backing store. Under real
 *   Chart.js those attributes are Chart.js's OWN — `retinaScale` assigns
 *   `canvas.width`/`canvas.height` on every responsive resize and both
 *   reflect to content attributes, measured on the real workout template in
 *   Chromium. So "a real smoke render asserts no canvas carries
 *   width/height" was never true, and the claim must not be restated as a
 *   property of Chart.js anywhere.
 *
 * **The live read happens at ONE INSTANT, on the synchronous stack, and
 * that is evadable.** `lintSurfaceBundle` is synchronous end to end, so
 * every `inspect()` runs inside it: microtasks queued by a handler flush
 * only after the gate has returned its result, and timers never run at all.
 * A handler that reassigns `chart.options` inside `Promise.resolve().then(…)`
 * or `setTimeout(…, 0)` therefore passes clean — both measured against this
 * file, alongside the synchronous reassignment and the in-place
 * `options.responsive = false`, which are caught.
 *
 * This is NOT fixed by draining microtasks before the last inspection, and
 * the gate deliberately does not pretend otherwise:
 *
 * - There is no synchronous microtask drain in JS. Draining means awaiting,
 *   which means `lintSurfaceBundle` becomes async — an API break across its
 *   four synchronous callers.
 * - One drain is one tick. A `.then().then().then()` chain needs as many,
 *   and the chain length is the app's to choose, so "drain until quiet" is
 *   not a terminating loop against a promise that re-queues itself.
 * - Timers are a different scheduler and a drain does nothing for them, so
 *   the commonest deferral spelling of all would still walk past.
 *
 * The general statement, which no amount of scheduling work reaches: an
 * oracle that READS a mutable object at a chosen moment is evaded by
 * WRITING to it after that moment, and the gate's moment is finite while
 * the app's turn is not. What this rule can honestly claim is that the
 * chart was correctly sized as of the last press the gate made. That is a
 * coverage limit on a QUALITY rule — a chart that resizes itself badly one
 * tick later is a bad chart, not an escape from the sandbox — and it is
 * pinned by a fixture (`chartReassignedInMicrotask`) that asserts the miss,
 * so closing it later cannot happen silently.
 */
function checkChartSizing(
  collector: Collector,
  seen: Set<string>,
  root: ShellRun['root'],
  live: readonly LiveChart[],
  when: string
): void {
  // The render loop runs once per declared action, so the same broken canvas
  // would otherwise be reported N+1 times. `seen` keys on the DEFECT, not on
  // the render pass, so a self-repair loop gets one finding per defect while
  // a defect that only appears in a later state is still caught.
  const once = (key: string, message: string) => {
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    collector.add({ rule: 'chart-sizing', severity: 'error', message });
  };

  const canvases = root.querySelectorAll('canvas');
  for (let index = 0; index < canvases.length; index++) {
    const canvas = canvases[index];
    for (const dimension of ['width', 'height'] as const) {
      // `width`/`height` are reflected properties on a canvas, so this one
      // attribute read covers the markup form (`<canvas width="480">`), the
      // interpolated form, and an imperative `el.width = 480` through a ref.
      // All three are asserted in the suite. The reflection is also why a
      // REAL Chart.js render sets them (see the header) — this leg is sound
      // only against the recording stand-in.
      const attribute = canvas.getAttribute(dimension);
      if (attribute !== null) {
        once(
          `canvas-attribute:${dimension}:${attribute}`,
          `rendered canvas (${when}) carries a ${dimension}="${attribute}" attribute; the chart primitive owns sizing`
        );
      }
    }
  }
  for (const chart of live) {
    if (chart.destroyed) {
      continue;
    }
    const options = isRecord(chart.options) ? chart.options : {};
    if (options.responsive !== true) {
      once(
        `chart-responsive:${JSON.stringify(options.responsive)}`,
        `a live chart (${when}) reports responsive=${JSON.stringify(options.responsive)}; charts must be responsive`
      );
    }
    if (options.maintainAspectRatio !== false) {
      once(
        `chart-aspect:${JSON.stringify(options.maintainAspectRatio)}`,
        `a live chart (${when}) reports maintainAspectRatio=${JSON.stringify(options.maintainAspectRatio)}; the container owns the aspect ratio`
      );
    }
  }
}

/** Rule 11's warning layer — never the gate. */
function checkChartSourceGrep(collector: Collector, scan: ScannedBundle): void {
  for (const found of matchSpans(
    scan,
    CODE,
    /(?<![\w$])new\s+(?:[A-Za-z_$][\w$]*\s*\.\s*)?Chart\s*\(/
  )) {
    addSourceViolation(
      collector,
      scan,
      'chart-sizing',
      'warning',
      found.offset,
      'raw Chart constructor; primitives.Chart is the path that sizes correctly (behavioral check is authoritative)',
      found.match[0]
    );
  }
}

/**
 * The rules whose reach depends on the gate managing to run a handler. All
 * four only ever saw the initial render and the post-`sendState` renders
 * before activation existed: a chart built in a click handler, copy that
 * only appears once something is pressed, an anchor assembled on press, and
 * a handler that throws were invisible to every one of them.
 */
const ACTIVATION_WIDENED_RULES: readonly SurfaceLintRule[] = [
  'navigation-vector',
  'chart-sizing',
  'jargon',
  'smoke-render',
  // Fifth for the same reason: the count that disagrees is usually not the
  // opening one. The board this rule was written about opens with `claims`
  // empty, so its badge is absent until somebody presses something — the
  // "1 people active" is only ever on a screen activation reached.
  'count-agreement',
];

/**
 * A known-good bundle, kept as small as it can be while still exercising the
 * whole path the gate's behavioral phase depends on: registration, the htm
 * template tag, a primitive component, and one render into the DOM.
 *
 * It is the gate's control on itself. If THIS cannot render, the harness is
 * broken and every behavioral finding about the caller's bundle is noise.
 */
const HARNESS_CANARY_BUNDLE = `(function () {
  const { html, primitives } = surface;
  const { Card } = primitives;
  surface.register({
    render(state) {
      return html\`<\${Card} title="canary">\${String(state.ok)}<//>\`;
    },
  });
})();`;

const HARNESS_CANARY_SPEC = {
  surfaceId: 'srf-gate-canary',
  specRevision: 1,
  title: 'canary',
  actions: {},
};

/**
 * Render the canary and report why the harness is unusable, or null.
 *
 * Deliberately conservative: it reports a problem only when the KNOWN-GOOD
 * bundle fails, which no change to the caller's files can cause and no change
 * to the caller's files can fix.
 */
function harnessProblem(win: unknown): string | null {
  try {
    const run = runShellFixture({
      window: win,
      bundleSource: HARNESS_CANARY_BUNDLE,
      spec: HARNESS_CANARY_SPEC,
      state: { ok: true },
      canInvoke: true,
      now: GATE_NOW,
    }) as ShellRun;
    const failure = run.messages.find(
      (message) => message.type === 'error' && message.phase !== 'bridge'
    );
    if (failure) {
      return `${failure.phase}: ${failure.message ?? ''}`.trim();
    }
    if ((run.root.textContent ?? '').includes('canary') === false) {
      return 'the canary bundle registered but painted nothing';
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function runBehavioralPhase(
  collector: Collector,
  input: SurfaceLintInput,
  spec: SurfaceSpec,
  rawActions: RawAction[],
  jargonTerms: readonly string[]
): string | null {
  const makeWindow = input.createWindow ?? (() => new Window());

  /**
   * The gate's control on itself, FIRST and in its OWN window: if a
   * known-good bundle cannot render here, the harness is broken and nothing
   * this phase would say about the caller's bundle is a fact about the
   * caller's bundle. Reported as an environment failure rather than as a
   * violation, because a violation tells a repair loop to rewrite files that
   * are fine.
   *
   * A separate window is load-bearing, not tidiness. Sharing one leaves the
   * canary's mounted shell root in the document the real run then renders
   * into, and the activation pass — which decides whether a control is inside
   * "the rendered output" by containment — starts attributing the caller's
   * controls to the wrong root. Measured: it turned one shortfall reason into
   * a different one. A control that perturbs its subject is not a control.
   */
  const canaryWindow = makeWindow() as Record<string, unknown>;
  const restoreCanaryGlobals = installDomGlobals(canaryWindow);
  let problem: string | null;
  try {
    problem = harnessProblem(canaryWindow);
  } finally {
    restoreCanaryGlobals();
  }
  if (problem !== null) {
    return problem;
  }

  const win = makeWindow() as Record<string, unknown>;
  const restoreGlobals = installDomGlobals(win);
  const recorder = recordEventBindings(win);
  const errors = watchHandlerErrors(win);
  try {
    foldAndRender(
      collector,
      input,
      spec,
      rawActions,
      jargonTerms,
      win,
      recorder,
      errors
    );
    return null;
  } finally {
    errors.restore();
    recorder.restore();
    restoreGlobals();
  }
}

/**
 * Rule 16 — the time-display declaration matches what the app actually paints.
 *
 * Asked BEHAVIORALLY, not by reading the source: render the initial state at
 * `GATE_NOW`, render it again a day later, and compare the painted copy. The
 * shell's `now` is the only thing that moved, so a difference is the app
 * deriving something from the clock and nothing else. A regex over the bundle
 * would answer a different question — `context.now` can be destructured,
 * aliased, passed to a helper, or named anything at all, and a bundle can
 * mention it in dead code it never renders.
 *
 * Two findings, and the asymmetry is deliberate.
 *
 * - **Paints time, declares nothing: an ERROR.** The host only runs a refresh
 *   timer for a spec that declares `timeDisplay`, so this app's screen is
 *   frozen at whatever `now` it was opened with. That is not a cosmetic
 *   shortfall: a countdown that stops counting reads as broken, and — worse
 *   for this gate — the twelve preview cells a reviewer scored are a snapshot
 *   of a screen that will not stay true, so the sheet they signed is about an
 *   app nobody will see.
 * - **Declares it, paints nothing: a WARNING.** The cost is a timer that
 *   repaints an unchanged screen, which is waste and not a defect, and the
 *   probe can be wrong in this direction: an app whose clock-derived text
 *   happens not to change across one day (a target three months out rendered
 *   to the month) is time-displaying and looks static here. An error would
 *   refuse a correct app on the strength of a probe that admits it cannot see
 *   everything.
 *
 * Restores `GATE_NOW` before returning, so everything downstream renders at
 * the gate's canonical clock.
 */
function checkTimeDisplay(
  collector: Collector,
  spec: SurfaceSpec,
  run: ShellRun
): void {
  const declared = spec.timeDisplay !== undefined;
  const atNow = renderedCopy(run.root);
  run.sendNow(GATE_NOW + GATE_NOW_PROBE_OFFSET_MS);
  const aDayLater = renderedCopy(run.root);
  run.sendNow(GATE_NOW);
  const paintsTime = atNow !== aDayLater;

  if (paintsTime && !declared) {
    collector.add({
      rule: 'time-display',
      severity: 'error',
      message:
        'the screen changes when the host-supplied `now` advances by a day, but the spec declares no timeDisplay — so the host never sends a fresh `now` and this app is frozen at whatever clock it was opened with. Declare timeDisplay: { refreshSeconds: <n> }, or derive the screen from state only',
      specPath: 'timeDisplay',
    });
    return;
  }
  if (!paintsTime && declared) {
    collector.add({
      rule: 'time-display',
      severity: 'warning',
      message:
        'the spec declares timeDisplay, but advancing the host-supplied `now` by a day changed nothing on screen, so the refresh timer would repaint an identical screen forever. Drop timeDisplay unless the app really does derive something from `now` that this probe cannot see over one day',
      specPath: 'timeDisplay',
    });
  }
}

function foldAndRender(
  collector: Collector,
  input: SurfaceLintInput,
  spec: SurfaceSpec,
  rawActions: RawAction[],
  jargonTerms: readonly string[],
  win: unknown,
  recorder: ControlRecorder,
  errors: HandlerErrorWatch
): void {
  const hostShip = GATE_HOST_SHIP;
  const actorShip = GATE_ACTOR_SHIP;
  // Read off `input` rather than threaded through two signatures the way
  // `jargonTerms` is: `input` is already here, and the rule has no lexical leg
  // upstream that would need the same list.
  const countNouns = [...SURFACE_COUNT_NOUNS, ...(input.extraCountNouns ?? [])];
  // Every chart the run ever built, kept for the whole phase: the oracle
  // reads each instance's CURRENT options, so an instance must outlive the
  // render pass that created it.
  const live: LiveChart[] = [];

  let run: ShellRun;
  try {
    run = runShellFixture({
      window: win,
      bundleSource: input.bundleSource,
      spec,
      state: spec.initialState,
      canInvoke: true,
      // The gate is a host, so it supplies the clock like one — fixed, so
      // every comparison below is a comparison of the app and not of the time
      // between two lines of this function.
      now: GATE_NOW,
      chart: createRecordingChart(live),
    }) as ShellRun;
  } catch (error) {
    collector.add({
      rule: 'smoke-render',
      severity: 'error',
      message: `bundle could not be evaluated as a plain script: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    collector.skip(
      'time-display',
      'the bundle never evaluated, so nothing was rendered to compare across two clock readings'
    );
    return;
  }

  let seen = 0;
  const drainErrors = (when: string) => {
    for (; seen < run.messages.length; seen++) {
      const message = run.messages[seen];
      if (message.type !== 'error') {
        continue;
      }
      if (message.phase === 'init') {
        collector.add({
          rule: 'entry-point',
          severity: 'error',
          message:
            `shell refused the registration (${when}): ${message.message ?? ''}`.trim(),
        });
        continue;
      }
      collector.add({
        rule: 'smoke-render',
        severity: 'error',
        message: `render threw (${when}): ${message.message ?? ''}`.trim(),
      });
    }
  };

  const seenBehavioral = new Set<string>();
  const reportedHandlerErrors = new Set<string>();
  const invokedByControls = new Set<string>();
  const unactivatedEvents = new Set<string>();
  // Unions across every activation pass, keyed on the control itself, so a
  // control that is unreachable in all of them is one shortfall and not one
  // per rendered state.
  const controlsOutsideRoot = new Set<object>();
  const controlsUndispatched = new Set<object>();
  const everReachable = new Set<object>();
  let budgetExhausted = false;

  /** every behavioral read of one rendered state, in one place */
  const inspect = (when: string) => {
    drainErrors(when);
    checkChartSizing(collector, seenBehavioral, run.root, live, when);
    checkJargonInRendered(
      collector,
      seenBehavioral,
      jargonTerms,
      renderedCopy(run.root),
      when
    );
    checkCountAgreementInRendered(
      collector,
      seenBehavioral,
      countNouns,
      renderedCopyRuns(run.root),
      when
    );
    checkNavigationInRendered(collector, seenBehavioral, run.root, when);
  };

  /** press what is on screen, then look again at what pressing produced */
  const activate = (when: string) => {
    if (recorder.unavailable !== null) {
      return;
    }
    const outcome = activateControls(
      // The shared harness reports a throwing handler through a callback; the
      // gate files exactly the violation it filed when the reporting was
      // hard-wired into it.
      (message) =>
        collector.add({ rule: 'smoke-render', severity: 'error', message }),
      run,
      recorder,
      errors,
      reportedHandlerErrors,
      everReachable,
      when
    );
    for (const actionId of outcome.invoked) {
      invokedByControls.add(actionId);
    }
    for (const type of outcome.otherEvents) {
      unactivatedEvents.add(type);
    }
    for (const control of outcome.outsideRoot) {
      controlsOutsideRoot.add(control);
    }
    for (const control of outcome.undispatched) {
      controlsUndispatched.add(control);
    }
    budgetExhausted = budgetExhausted || outcome.budgetExhausted;
    inspect(`${when}, controls activated`);
  };

  inspect('initial state');
  checkTimeDisplay(collector, spec, run);
  activate('initial state');

  const preserving = spec.preserveState === true;
  // A preserving spec has no state until the host posts a migration snapshot
  // at the current revision (plan §6), so the fold below would report
  // migration-pending and prove nothing. The gate stands in the snapshot of
  // `initialState` at sequence 0 the host is required to post, and folds the
  // invokes above it.
  const base = preserving
    ? [snapshotPost(spec, hostShip, spec.initialState)]
    : [];

  for (const action of rawActions) {
    const usesAppend = action.ops.some((op) => op.op === 'append');

    const once = reduceSurface({
      spec,
      hostShip,
      posts: [...base, invokePost(spec, action.id, actorShip, 1)],
    });
    const twice = reduceSurface({
      spec,
      hostShip,
      posts: [
        ...base,
        invokePost(spec, action.id, actorShip, 1),
        invokePost(spec, action.id, actorShip, 2),
      ],
    });

    if (once.status !== 'reduced' || twice.status !== 'reduced') {
      collector.add({
        rule: 'action-idempotency',
        severity: 'error',
        message: `folding "${action.id}" produced no state (${once.status}); the gate cannot verify it`,
        specPath: `actions.${action.id}`,
      });
      continue;
    }

    // An action the reducer REFUSES on every path. The classic shape is a
    // partial-segment `$actor` (`/votes/$actor-choice`), which
    // `resolveActorSegments` rejects as a grammar error, aborting the whole
    // entry — so the action is declared, drawn, pressable, and can never
    // move the board.
    //
    // Every existing rule was structurally blind to it, which is why this
    // needed its own: `pointer-hygiene` sees a legal pointer;
    // `action-idempotency` sees two identical states, because a refused fold
    // is trivially idempotent; the activation shortfall sees a control that
    // does invoke it; and `no-op-control` EXCLUDES it, because the walk skips
    // aborted edges (`edge.aborted`). A dead action shipped green.
    //
    // The signal was already in hand and simply never read: `reduceSurface`
    // returns `abortedSequenceNums`, and nothing in this file looked at it.
    // A raw prefix compare is not a path compare (D192): `actions.vote` is a
    // prefix of `actions.vote-no`, so a rule-8 finding against a malformed
    // `vote-no` suppressed the genuinely dead `vote`, and the author repaired
    // one defect, re-ran the gate, and met the other. Segments, or nothing.
    const abortedEvery =
      once.abortedSequenceNums.length === 1 &&
      twice.abortedSequenceNums.length === 2;
    // Only speak when no earlier rule already explained this action's
    // refusal. A statically-malformed pointer (`pointer-hygiene`, rule 8)
    // also aborts every fold, and reporting both would tell the repairing
    // model that one broken path is two separate defects. This rule's whole
    // reason to exist is the refusal that passes every static check, so it
    // yields to any finding already filed against the same action.
    const alreadyExplained = collector.violations.some((violation) =>
      specPathIsUnder(violation.specPath, `actions.${action.id}`)
    );
    if (abortedEvery && !alreadyExplained) {
      collector.add({
        rule: 'inert-action',
        severity: 'error',
        message: `every fold of "${action.id}" is refused by the reducer, so pressing its control can never change the board — it is declared and drawn but dead. The usual cause is a path the reducer rejects outright, such as partial-segment $actor (/votes/$actor-choice); $actor must be a whole path segment (/votes/$actor)`,
        specPath: `actions.${action.id}`,
      });
    }

    run.sendState(once.state);
    inspect(`after invoking "${action.id}"`);
    activate(`after invoking "${action.id}"`);

    // The shared helper (D72), not a private copy. The copy that used to live
    // here differed on exactly one input: it emitted a bare `undefined` token
    // for an `undefined`-valued key instead of dropping it. Reducer state
    // cannot hold one — it starts as schema-validated `initialState` (parsed
    // JSON, so no `undefined` anywhere) and `del` removes the key outright
    // (`delete copy[key]` in the shared jsonPointer) rather than blanking it —
    // so the two agree on every value this line can see, and the surviving
    // helper is the one whose output matches a JSON round trip.
    const diverged = canonicalJson(once.state) !== canonicalJson(twice.state);
    if (diverged && !action.duplicatesTolerated) {
      collector.add({
        rule: 'action-idempotency',
        severity: 'error',
        message: `invoking "${action.id}" twice produces different state; a double-tap, a transport retry and the same member on two devices are indistinguishable (D54). Make it idempotent (set /…/$actor) or declare duplicatesTolerated: true`,
        specPath: `actions.${action.id}`,
      });
    }
    if (usesAppend && !action.duplicatesTolerated) {
      collector.add({
        rule: 'action-idempotency',
        severity: 'error',
        message: `"${action.id}" uses append, which cannot be made idempotent in v0; declare duplicatesTolerated: true to accept duplicate entries, or use the host-is-the-clock pattern instead (D54)`,
        specPath: `actions.${action.id}`,
      });
    }
  }

  reportActivationShortfall(collector, {
    unavailable: recorder.unavailable,
    unreached: rawActions
      .map((action) => action.id)
      .filter((id) => !invokedByControls.has(id)),
    otherEvents: [...unactivatedEvents].sort(),
    outsideRoot: controlsOutsideRoot.size,
    undispatched: controlsUndispatched.size,
    budgetExhausted,
  });
}

/**
 * What the activation pass could NOT reach, said out loud.
 *
 * A control the gate never pressed is a handler that never ran, and every
 * rule in `ACTIVATION_WIDENED_RULES` is silent about whatever that handler
 * does. Reporting that as a clean pass is exactly the failure mode the
 * gate's skip discipline exists to prevent, so it is reported as a partial
 * skip on each affected rule instead — the rule ran, but not over
 * everything, and the reason names what was missed.
 *
 * **What this used to claim, and why it was false.** Shortfalls were
 * derived only from the declared ACTIONS — the ids no activated control
 * invoked. A control is not an action, and the two come apart whenever some
 * OTHER control invokes everything the spec declares: three routes then
 * reached nothing at all while all four widened rules reported clean with
 * zero skips, each verified against this file.
 *
 * - a listener taken on `document` (event delegation) — recorded, then
 *   dropped by the reachability filter because the rendered root does not
 *   contain the document;
 * - a listener taken on the rendered root itself — reachable, marked, budget
 *   spent, and then clicked through `root.querySelector`, which never
 *   matches the root;
 * - `el.onclick = fn`, which never calls `addEventListener`, so the recorder
 *   did not see the element at all.
 *
 * The first two are now counted where they are dropped and reported here.
 * The third is recorded at the setter (`wrapOnClickSetter`) and therefore
 * pressed, or counted with the other two when it sits outside the root.
 *
 * **What silence here does and does not mean.** No shortfall means: every
 * control the recorder saw was pressed, and every declared action was
 * invoked by one of them. It does NOT mean the app has controls — an app
 * that binds nothing has nothing to activate, and reports nothing, which is
 * the honest answer rather than a hole. Nor does it mean every control was
 * FOUND: a handler property other than `onclick` is not observed at all
 * (see `recordEventBindings`), so it is missing from both the presses and
 * this accounting.
 *
 * **Why this and `surface-transitions.ts` legitimately disagree, and which to
 * trust for what.** Both compute "declared actions no control invoked", and
 * they are answers to different questions:
 *
 * - The gate walks a DEPTH-1 STAR: the initial render, plus one render per
 *   declared action folded once from `initialState`. Those screens include
 *   states no member can reach, so an action invoked only from one of them
 *   still counts as reached here. What this set means is "the gate never ran
 *   that handler", which is a fact about the gate's COVERAGE — hence a skip on
 *   four rules, not a violation.
 * - The reachability walk composes presses from the opening screen and takes
 *   the edges out of a state to be the actions the controls RENDERED IN IT
 *   invoke. Its set means "no sequence of presses reaches that control", which
 *   is a fact about the APP — hence a defect.
 *
 * Neither set contains the other, and the divergence is the interesting part
 * rather than a bug: an action invocable only from an unreachable screen is
 * silent here and loud there. Wiring the gate onto the real graph was
 * considered and refused: every behavioral rule inspects each rendered state,
 * so the gate would inspect thousands of them on a board like D140's, on every
 * publish. The gate stays depth-1 and says so; reachability is preview's.
 */
function reportActivationShortfall(
  collector: Collector,
  outcome: {
    unavailable: string | null;
    unreached: readonly string[];
    otherEvents: readonly string[];
    /** controls bound outside the tree the gate renders into */
    outsideRoot: number;
    /** controls the click dispatcher could not deliver to */
    undispatched: number;
    budgetExhausted: boolean;
  }
): void {
  const shortfalls: string[] = [];
  if (outcome.unavailable !== null) {
    shortfalls.push(`no control could be activated: ${outcome.unavailable}`);
  }
  if (outcome.unreached.length > 0) {
    shortfalls.push(
      `no control on the initial screen, or on any screen ONE declared action from it, invoked ${outcome.unreached
        .map((id) => `"${id}"`)
        .join(', ')}, so nothing was observed for ${
        outcome.unreached.length === 1 ? 'it' : 'them'
      } — this is a statement about the gate's reach and not about the app; "can a member get to that control at all" is the reachability walk in surface preview`
    );
  }
  if (outcome.otherEvents.length > 0) {
    shortfalls.push(
      `controls bound only to ${outcome.otherEvents.join(', ')} were left alone (the gate dispatches click)`
    );
  }
  if (outcome.outsideRoot > 0) {
    shortfalls.push(
      `${plural(outcome.outsideRoot, 'control')} bound outside the rendered output (a delegated listener on the document, or a detached element) could not be pressed`
    );
  }
  if (outcome.undispatched > 0) {
    shortfalls.push(
      `${plural(outcome.undispatched, 'control')} took a click the gate could not dispatch to (a listener on the rendered root itself)`
    );
  }
  if (outcome.budgetExhausted) {
    shortfalls.push(
      `the ${MAX_ACTIVATION_CLICKS}-click activation budget ran out`
    );
  }
  if (shortfalls.length === 0) {
    return;
  }
  for (const rule of ACTIVATION_WIDENED_RULES) {
    collector.skip(rule, `not fully exercised — ${shortfalls.join('; ')}`);
  }
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

const RULE_ORDER = new Map<SurfaceLintRule, number>(
  SURFACE_LINT_RULES.map((rule, index) => [rule, index])
);

function sortViolations(
  violations: SurfaceLintViolation[]
): SurfaceLintViolation[] {
  return [...violations].sort((left, right) => {
    const byRule =
      (RULE_ORDER.get(left.rule) ?? 0) - (RULE_ORDER.get(right.rule) ?? 0);
    if (byRule !== 0) {
      return byRule;
    }
    return (
      (left.line ?? 0) - (right.line ?? 0) ||
      (left.column ?? 0) - (right.column ?? 0)
    );
  });
}

/**
 * Runs the whole gate. Rules never short-circuit each other except where a
 * later rule is genuinely unanswerable: a bundle carrying module syntax
 * cannot be evaluated, and a spec that fails its schema has no validated
 * actions to fold, so the behavioral phase is SKIPPED (and says so) rather
 * than reporting a derived failure the repair loop would chase.
 */
export function lintSurfaceBundle(input: SurfaceLintInput): SurfaceLintResult {
  const collector = createCollector();
  const scan = scanBundle(input.bundleSource);
  const jargonTerms = [...SURFACE_JARGON_TERMS, ...(input.extraJargon ?? [])];

  checkByteCap(collector, input.bundleSource);
  checkModuleSyntax(collector, scan);
  checkExternalReferences(collector, scan);
  checkForbiddenApis(collector, scan);
  checkNavigationVectors(collector, scan);
  checkEntryPoint(collector, scan);
  // Rule 16's lexical leg. It runs in the static phase, so a bundle that
  // cannot be evaluated at all still gets told it reads the clock — the
  // behavioral leg is skipped in that case and would otherwise say nothing.
  checkAmbientTime(collector, scan);

  const rawActions = readRawActions(input.spec);
  checkActionCrossReference(
    collector,
    scan,
    rawActions.map((action) => action.id)
  );
  checkPointerHygiene(collector, rawActions);
  checkMemberInteraction(collector, input.spec);
  const spec = checkSpecSchema(collector, input.spec);
  checkStyles(collector, scan);
  checkChartSourceGrep(collector, scan);
  checkJargonLexically(collector, scan, jargonTerms);

  let environment: string | null = null;
  const behavioralRules: SurfaceLintRule[] = [
    'chart-sizing',
    'smoke-render',
    'action-idempotency',
    // The time-display probe is two renders and a comparison, so it lives or
    // dies with the behavioral phase like the other three. Listed here rather
    // than left off: a rule that silently does not run is the vacuous kind of
    // check this file's skip discipline exists to prevent.
    'time-display',
    // Count agreement has no lexical leg at all — the source says `${n}
    // people` and the defect only exists once something renders a one — so a
    // bundle that never rendered was never checked, and has to say so.
    'count-agreement',
  ];
  const moduleSyntaxFailed = collector.violations.some(
    (violation) => violation.rule === 'module-syntax'
  );
  if (spec === null) {
    for (const rule of behavioralRules) {
      collector.skip(rule, 'spec failed schema validation; nothing to render');
    }
  } else if (moduleSyntaxFailed) {
    for (const rule of behavioralRules) {
      collector.skip(
        rule,
        'bundle uses module syntax and cannot be evaluated as a plain script'
      );
    }
  } else {
    environment = runBehavioralPhase(
      collector,
      input,
      spec,
      rawActions,
      jargonTerms
    );
    if (environment !== null) {
      for (const rule of behavioralRules) {
        collector.skip(rule, `the gate's own harness could not render`);
      }
    }
  }

  const all = sortViolations(collector.violations);
  const violations = all.filter((entry) => entry.severity === 'error');
  const warnings = all.filter((entry) => entry.severity === 'warning');
  return {
    ok: violations.length === 0,
    environment,
    violations,
    warnings,
    skipped: collector.skipped,
  };
}

/** A compact, stable rendering of a result for logs and bot transcripts. */
export function formatSurfaceLintResult(result: SurfaceLintResult): string {
  const lines: string[] = [];
  for (const violation of [...result.violations, ...result.warnings]) {
    const where =
      violation.line !== undefined
        ? `bundle:${violation.line}:${violation.column ?? 1}`
        : (violation.specPath ?? 'bundle');
    lines.push(
      `${violation.severity} ${violation.rule} ${where}: ${violation.message}`
    );
  }
  for (const skip of result.skipped) {
    lines.push(`skipped ${skip.rule}: ${skip.reason}`);
  }
  return lines.join('\n');
}
