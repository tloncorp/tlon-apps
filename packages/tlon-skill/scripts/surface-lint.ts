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
  };
  messages: ShellMessage[];
  sendState(state: Record<string, unknown>): void;
}

interface ShellElement {
  getAttribute(name: string): string | null;
}

interface ShellMessage {
  type: string;
  phase?: string;
  message?: string;
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

/**
 * Rule 5 — navigation vectors. On web the gate is the PRIMARY boundary
 * against navigation egress: no sandbox token or shipped CSP directive stops
 * a frame navigating itself, so a bundle that can reach `location` can make
 * a request leave the device (plan §5, D52).
 */
function checkNavigationVectors(
  collector: Collector,
  scan: ScannedBundle
): void {
  const codePatterns: { pattern: RegExp; message: string }[] = [
    {
      pattern: /(?<![\w$])location\b/,
      message:
        'location is a navigation vector; navigating the frame is egress the sandbox cannot block',
    },
    {
      pattern: /(?<![\w$])document\s*\.\s*write(?:ln)?\s*\(/,
      message: 'document.write can rewrite the frame into unpinned markup',
    },
    {
      pattern: /(?<![\w$.])open\s*\(/,
      message: 'open() is a navigation vector',
    },
    {
      pattern:
        /(?<![\w$])(?:window|self|globalThis|top|parent)\s*\.\s*open\s*\(/,
      message: 'window.open is a navigation vector',
    },
  ];
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
      pattern: /<a\b[^>]*\bhref\b/i,
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
 * DO NOT "simplify" this onto the validated spec. `SurfaceActionSchema`
 * (`packages/api/src/client/surface/schemas.ts`) declares only `ops` and
 * `acceptStale`, and `z.object` STRIPS unknown keys — so
 * `duplicatesTolerated` survives validation but is `undefined` on every
 * parsed view. Reading it off the validated object would make a correctly
 * marked `append` action fail the gate with no way to pass. The flag lives
 * in the raw persisted spec and nowhere else; adding it to the api schema is
 * a wire-format change, not a lint change.
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

interface RecordedChart {
  config: { options?: Record<string, unknown> };
}

function createRecordingChart(recorded: RecordedChart[]): unknown {
  return class RecordingChart {
    static defaults = {
      color: undefined as unknown,
      borderColor: undefined as unknown,
      font: { family: undefined as unknown },
    };

    data: unknown;
    options: unknown;

    constructor(
      _canvas: unknown,
      config: { data?: unknown; options?: Record<string, unknown> }
    ) {
      recorded.push({ config });
      this.data = config.data;
      this.options = config.options;
    }

    update(): void {}

    destroy(): void {}
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
 * cannot be dodged is the rendered DOM and the config a live chart was
 * actually constructed with, which is exactly what both early bundles got
 * wrong. The source grep survives only as a warning layer.
 */
function checkChartSizing(
  collector: Collector,
  seen: Set<string>,
  root: ShellRun['root'],
  recorded: RecordedChart[],
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
      // Both are asserted in the suite.
      const attribute = canvas.getAttribute(dimension);
      if (attribute !== null) {
        once(
          `canvas-attribute:${dimension}:${attribute}`,
          `rendered canvas (${when}) carries a ${dimension}="${attribute}" attribute; the chart primitive owns sizing`
        );
      }
    }
  }
  for (const chart of recorded) {
    const options = chart.config.options ?? {};
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
  try {
    foldAndRender(collector, input, spec, rawActions, jargonTerms, win);
  } finally {
    restoreGlobals();
  }
}

function foldAndRender(
  collector: Collector,
  input: SurfaceLintInput,
  spec: SurfaceSpec,
  rawActions: RawAction[],
  jargonTerms: readonly string[],
  win: unknown
): void {
  const hostShip = GATE_HOST_SHIP;
  const actorShip = GATE_ACTOR_SHIP;
  const recorded: RecordedChart[] = [];

  let run: ShellRun;
  try {
    run = runShellFixture({
      window: win,
      bundleSource: input.bundleSource,
      spec,
      state: spec.initialState,
      canInvoke: true,
      chart: createRecordingChart(recorded),
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
  drainErrors('initial state');
  checkChartSizing(
    collector,
    seenBehavioral,
    run.root,
    recorded,
    'initial state'
  );
  checkJargonInRendered(
    collector,
    seenBehavioral,
    jargonTerms,
    renderedCopy(run.root),
    'initial state'
  );

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

    recorded.length = 0;
    run.sendState(once.state);
    drainErrors(`after invoking "${action.id}"`);
    checkChartSizing(
      collector,
      seenBehavioral,
      run.root,
      recorded,
      `after invoking "${action.id}"`
    );
    checkJargonInRendered(
      collector,
      seenBehavioral,
      jargonTerms,
      renderedCopy(run.root),
      `after invoking "${action.id}"`
    );

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
