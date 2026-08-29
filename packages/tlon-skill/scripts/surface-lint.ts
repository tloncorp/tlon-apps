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
  type ScannedBundle,
  type SurfaceSourceSpan,
  type SurfaceSpanKind,
  matchSpans,
  scanBundle,
} from './surface-bundle-scan';

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

const { SURFACE_CAPS, SurfaceSpecSchema } = surfaceSchemasModule as Pick<
  ApiModule,
  'SURFACE_CAPS' | 'SurfaceSpecSchema'
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

/**
 * The slice of `@tloncorp/surface-shell`'s `ShellFixtureRun` the gate uses.
 * Hand-mirrored because the shell package publishes only "exports" subpaths,
 * which tsc cannot follow under moduleResolution:Node. Tracks
 * `packages/surface-shell/src/node/index.ts` — if that changes shape, this
 * changes with it (same discipline as D33's mirrored protocol types).
 */
interface ShellRun {
  root: {
    textContent: string | null;
    querySelectorAll(selector: string): ArrayLike<ShellElement>;
    contains(node: unknown): boolean;
  };
  messages: ShellMessage[];
  sendState(state: Record<string, unknown>): void;
  /** dispatch a click on the first element matching the selector */
  click(selector: string): boolean;
}

interface ShellElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

interface ShellMessage {
  type: string;
  phase?: string;
  message?: string;
  actionId?: string;
}

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
 */
const GLOBAL_RECEIVER = '(?:window|self|globalThis|top|parent|frames|document)';

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
 * Where containment actually comes from on web: **pre-flight**, the host
 * page's `frame-src` allowlist, which blocks the sandbox frame's
 * self-navigation on chromium, firefox and webkit before the request leaves
 * the device (D43; ships written-but-disabled behind D44's flip criteria);
 * and **structurally**, the M4 Worker-realm migration, which removes the
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
      pattern:
        /(?<![\w$])(?:window|self|globalThis|top|parent)\s*\.\s*open\s*\(/,
      message: 'window.open is a navigation vector',
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
      pattern:
        /(?<![\w$])(?:inner|outer)HTML\s*=(?!=)|(?<![\w$])insertAdjacentHTML\s*\(/,
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
  const result = SurfaceSpecSchema.safeParse(spec);
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
/* Behavioral phase                                                    */
/* ------------------------------------------------------------------ */

/**
 * A chart the gate can interrogate. This is the LIVE INSTANCE, never the
 * config it was constructed with: `options` is read at check time, so a
 * bundle that constructs responsively and then reassigns `chart.options`
 * reads as what it ended up being. Reading the saved constructor config
 * instead is the defect this shape exists to remove — that oracle passed a
 * bundle whose chart was non-responsive on screen.
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

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

interface SurfacePostLike {
  authorId: string;
  sequenceNum: number;
  blob: string;
}

function invokePost(
  spec: SurfaceSpec,
  actionId: string,
  actor: string,
  sequenceNum: number
): SurfacePostLike {
  return {
    authorId: actor,
    sequenceNum,
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
  };
}

/**
 * A preserving spec has no state until the host posts a migration snapshot
 * at the current revision (plan §6), so the fold below would report
 * migration-pending and prove nothing. The gate stands in a snapshot of
 * `initialState` at sequence 0 — the state the host is required to post —
 * and folds the invokes above it.
 */
function migrationSnapshotPost(
  spec: SurfaceSpec,
  hostShip: string
): SurfacePostLike {
  return {
    authorId: hostShip,
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
 * Preact reaches for the ambient `document`, not the window the shell was
 * handed — under vitest's happy-dom environment those are the same object,
 * but a CLI process has no DOM at all, so the smoke render would throw
 * `document is not defined` before it reached any app code. The gate stands
 * the injected window up as the ambient one for the duration of the render
 * and puts back whatever was there.
 *
 * The whole lint is synchronous, so nothing of ours can observe the swap;
 * an async caller sharing the process could, which is why it is scoped this
 * tightly rather than installed once at import.
 */
function installDomGlobals(win: Record<string, unknown>): () => void {
  const names = ['window', 'document', 'Node', 'Element', 'HTMLElement'];
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map<string, { present: boolean; value: unknown }>();
  for (const name of names) {
    previous.set(name, {
      present: name in globals,
      value: globals[name],
    });
    const replacement = name === 'window' ? win : win[name];
    if (replacement !== undefined) {
      globals[name] = replacement;
    }
  }
  return () => {
    for (const [name, saved] of previous) {
      if (saved.present) {
        globals[name] = saved.value;
      } else {
        delete globals[name];
      }
    }
  };
}

/* ------------------------------------------------------------------ */
/* Control activation                                                  */
/* ------------------------------------------------------------------ */

/**
 * How many clicks one activation pass may spend. A control that adds
 * another control on every press is otherwise unbounded, and a lint that
 * does not terminate is worse than one that misses something — so the
 * budget exists, and running out is REPORTED rather than swallowed.
 */
const MAX_ACTIVATION_CLICKS = 64;

/** Temporary hook for `ShellFixtureRun.click`, which takes a selector. */
const CONTROL_MARKER = 'data-surface-lint-control';

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
];

interface ControlRecorder {
  /** every event target that took a listener, and the types it took */
  bindings: Map<object, Set<string>>;
  /** set when activation cannot run at all, with the reason */
  unavailable: string | null;
  restore(): void;
}

/**
 * Records where the app bound its event listeners.
 *
 * Finding an app's controls by SELECTOR (`button`, `[role=button]`, …)
 * would miss `<div onClick=…>`, which htm/Preact bind as readily as a
 * button — and a control the gate cannot find is a handler the gate cannot
 * run. Preact attaches through `addEventListener`, so wrapping the method
 * on the prototype that owns it enumerates every listener the app took,
 * whatever element it sat on.
 *
 * The prototype is located by walking a real element's chain rather than by
 * reading `win.EventTarget`: on happy-dom those are two different objects
 * that happen to share the same function, so patching the latter records
 * nothing. Measured, and the reason this looks more indirect than it needs
 * to be.
 */
function recordEventBindings(win: Record<string, unknown>): ControlRecorder {
  const bindings = new Map<object, Set<string>>();
  const inert = { bindings, unavailable: null as string | null, restore() {} };
  const doc = win.document as
    | { createElement?: (tag: string) => object }
    | undefined;
  if (doc === undefined || typeof doc.createElement !== 'function') {
    return {
      ...inert,
      unavailable: 'the injected window exposes no document.createElement',
    };
  }
  let proto = Object.getPrototypeOf(doc.createElement('div')) as Record<
    string,
    unknown
  > | null;
  while (
    proto !== null &&
    !Object.prototype.hasOwnProperty.call(proto, 'addEventListener')
  ) {
    proto = Object.getPrototypeOf(proto) as Record<string, unknown> | null;
  }
  if (proto === null) {
    return {
      ...inert,
      unavailable:
        "the injected DOM's elements own no addEventListener to observe",
    };
  }
  const owner = proto;
  const original = owner.addEventListener as (...args: unknown[]) => unknown;
  owner.addEventListener = function (
    this: object,
    type: unknown,
    ...rest: unknown[]
  ) {
    const types = bindings.get(this) ?? new Set<string>();
    types.add(String(type));
    bindings.set(this, types);
    return original.call(this, type, ...rest);
  };
  return {
    bindings,
    unavailable: null,
    restore() {
      owner.addEventListener = original;
    },
  };
}

interface HandlerErrorWatch {
  /** only errors raised while a click is in flight are attributed to it */
  armed: boolean;
  messages: string[];
  restore(): void;
}

/**
 * A throwing click handler is swallowed by the DOM's own dispatch — the
 * exception never reaches `el.click()`'s caller — and reported as an
 * `error` event on the window instead. Without this watch, "the app breaks
 * when you press the button" is a defect the smoke render runs into and
 * then discards.
 */
function watchHandlerErrors(win: Record<string, unknown>): HandlerErrorWatch {
  const watch: HandlerErrorWatch = {
    armed: false,
    messages: [],
    restore() {},
  };
  const target = win as unknown as {
    addEventListener?: (
      type: string,
      listener: (event: unknown) => void
    ) => void;
    removeEventListener?: (
      type: string,
      listener: (event: unknown) => void
    ) => void;
  };
  if (typeof target.addEventListener !== 'function') {
    return watch;
  }
  const listener = (event: unknown) => {
    if (!watch.armed) {
      return;
    }
    const detail = event as
      | { message?: unknown; error?: { message?: unknown } }
      | undefined;
    const message =
      typeof detail?.message === 'string' && detail.message.length > 0
        ? detail.message
        : typeof detail?.error?.message === 'string'
          ? detail.error.message
          : 'an unnamed error';
    watch.messages.push(message);
  };
  target.addEventListener('error', listener);
  watch.restore = () => {
    target.removeEventListener?.('error', listener);
  };
  return watch;
}

interface ActivationOutcome {
  /** action ids an activated control actually invoked */
  invoked: Set<string>;
  /** event types bound to controls the gate never dispatched */
  otherEvents: Set<string>;
  budgetExhausted: boolean;
}

function isActivatable(candidate: object): candidate is ShellElement {
  const element = candidate as Partial<ShellElement>;
  return (
    typeof element.setAttribute === 'function' &&
    typeof element.removeAttribute === 'function'
  );
}

/**
 * Presses every control the app bound a click to, and reports what came
 * back. Controls that appear only after another control is pressed are
 * picked up on the next round, because the recorder keeps seeing bindings
 * as they are made.
 */
function activateControls(
  collector: Collector,
  run: ShellRun,
  recorder: ControlRecorder,
  errors: HandlerErrorWatch,
  reportedErrors: Set<string>,
  when: string
): ActivationOutcome {
  const outcome: ActivationOutcome = {
    invoked: new Set<string>(),
    otherEvents: new Set<string>(),
    budgetExhausted: false,
  };
  const visited = new Set<object>();
  let budget = MAX_ACTIVATION_CLICKS;

  for (;;) {
    const pending = [...recorder.bindings.entries()].filter(
      ([element]) =>
        !visited.has(element) &&
        isActivatable(element) &&
        run.root.contains(element)
    );
    if (pending.length === 0) {
      break;
    }
    for (const [element, types] of pending) {
      visited.add(element);
      if (!types.has('click')) {
        for (const type of types) {
          outcome.otherEvents.add(type);
        }
        continue;
      }
      if (budget <= 0) {
        outcome.budgetExhausted = true;
        break;
      }
      budget -= 1;
      const control = element as ShellElement;
      const before = run.messages.length;
      control.setAttribute(CONTROL_MARKER, '');
      errors.armed = true;
      try {
        run.click(`[${CONTROL_MARKER}]`);
      } catch (error) {
        collector.add({
          rule: 'smoke-render',
          severity: 'error',
          message: `activating a control (${when}) threw: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      } finally {
        errors.armed = false;
        control.removeAttribute(CONTROL_MARKER);
      }
      for (let index = before; index < run.messages.length; index++) {
        const message = run.messages[index];
        if (message.type === 'invoke' && typeof message.actionId === 'string') {
          outcome.invoked.add(message.actionId);
        }
      }
    }
    if (outcome.budgetExhausted) {
      break;
    }
  }

  for (const message of errors.messages.splice(0)) {
    if (reportedErrors.has(message)) {
      continue;
    }
    reportedErrors.add(message);
    collector.add({
      rule: 'smoke-render',
      severity: 'error',
      message: `a control's handler threw (${when}): ${message}`,
    });
  }
  return outcome;
}

function runBehavioralPhase(
  collector: Collector,
  input: SurfaceLintInput,
  spec: SurfaceSpec,
  rawActions: RawAction[],
  jargonTerms: readonly string[]
): void {
  const makeWindow = input.createWindow ?? (() => new Window());
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
  } finally {
    errors.restore();
    recorder.restore();
    restoreGlobals();
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
    checkNavigationInRendered(collector, seenBehavioral, run.root, when);
  };

  /** press what is on screen, then look again at what pressing produced */
  const activate = (when: string) => {
    if (recorder.unavailable !== null) {
      return;
    }
    const outcome = activateControls(
      collector,
      run,
      recorder,
      errors,
      reportedHandlerErrors,
      when
    );
    for (const actionId of outcome.invoked) {
      invokedByControls.add(actionId);
    }
    for (const type of outcome.otherEvents) {
      unactivatedEvents.add(type);
    }
    budgetExhausted = budgetExhausted || outcome.budgetExhausted;
    inspect(`${when}, controls activated`);
  };

  inspect('initial state');
  activate('initial state');

  const preserving = spec.preserveState === true;
  const base = preserving ? [migrationSnapshotPost(spec, hostShip)] : [];

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

    run.sendState(once.state);
    inspect(`after invoking "${action.id}"`);
    activate(`after invoking "${action.id}"`);

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
 */
function reportActivationShortfall(
  collector: Collector,
  outcome: {
    unavailable: string | null;
    unreached: readonly string[];
    otherEvents: readonly string[];
    budgetExhausted: boolean;
  }
): void {
  const shortfalls: string[] = [];
  if (outcome.unavailable !== null) {
    shortfalls.push(`no control could be activated: ${outcome.unavailable}`);
  }
  if (outcome.unreached.length > 0) {
    shortfalls.push(
      `no activated control invoked ${outcome.unreached
        .map((id) => `"${id}"`)
        .join(', ')}, so nothing was observed for ${
        outcome.unreached.length === 1 ? 'it' : 'them'
      }`
    );
  }
  if (outcome.otherEvents.length > 0) {
    shortfalls.push(
      `controls bound only to ${outcome.otherEvents.join(', ')} were left alone (the gate dispatches click)`
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

  const rawActions = readRawActions(input.spec);
  checkActionCrossReference(
    collector,
    scan,
    rawActions.map((action) => action.id)
  );
  checkPointerHygiene(collector, rawActions);
  const spec = checkSpecSchema(collector, input.spec);
  checkStyles(collector, scan);
  checkChartSourceGrep(collector, scan);
  checkJargonLexically(collector, scan, jargonTerms);

  const behavioralRules: SurfaceLintRule[] = [
    'chart-sizing',
    'smoke-render',
    'action-idempotency',
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
    runBehavioralPhase(collector, input, spec, rawActions, jargonTerms);
  }

  const all = sortViolations(collector.violations);
  const violations = all.filter((entry) => entry.severity === 'error');
  const warnings = all.filter((entry) => entry.severity === 'warning');
  return {
    ok: violations.length === 0,
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
