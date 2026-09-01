/**
 * The rubric artifact: the completed scoring sheet `surface publish` refuses
 * to publish without.
 *
 * Session 6a measured the thing this exists to make impossible. Across six
 * runs that reached preview, the model scored the rubric **zero times**: the
 * complete rubric output for four of them is four sentences, and the count of
 * capture cells actually opened was 3/12, 3/12, 0/12, 1/12, 1/12, 3/12. One
 * app shipped with no preview at all. `surface rubric` — the doctrine — was
 * run in three of those runs and changed nothing. The one run that repaired
 * against visual feedback did so because a tool handed it a list of concrete
 * defects. Doctrine that asks for self-assessment does not produce
 * self-assessment; a refusal does.
 *
 * ## Twelve cells or seven checks
 *
 * `RUBRIC.md` has seven universal checks (and one that applies only to an app
 * declaring itself display-only). The capture matrix has twelve cells. They are
 * not the same twelve and the artifact carries BOTH, for a measured reason:
 *
 * - The number 6a recorded as the failure is **cells opened** — 3/12, 0/12.
 *   The model was not looking at the images. So the artifact forces one
 *   observation per capture cell: twelve entries, keyed by the exact file
 *   names preview wrote.
 * - Twelve captions are not a review. A finding becomes a repair only through
 *   the checks, so the artifact also carries a verdict each — and every one
 *   one must name the cell it was seen in, which is what cross-links the two
 *   halves without either being decorative.
 *
 * Nineteen short strings. That is the whole cost, and it is deliberate: an
 * artifact expensive to emit correctly gets emitted incorrectly, and then the
 * refusal is measuring the model's JSON rather than its attention.
 *
 * ## What this validator will and will not do
 *
 * **Completeness only.** Every check here is presence, membership in a fixed
 * enumeration, or identity binding. None of them reads a note and decides
 * whether it is any good, because a validator that tried would be gameable
 * (any keyword heuristic is one synonym away from useless) or wrong (it would
 * reject accurate short observations). Content quality is the model's job.
 * Existence and completeness are the tool's.
 *
 * The single structural exception is `allCellNotesIdentical`: twelve copies of
 * one string is ONE observation recorded twelve times, not twelve
 * observations, and detecting that requires comparing strings to each other
 * rather than judging any of them. A model that writes twelve DIFFERENT
 * useless sentences still passes. That is the honest boundary and it is stated
 * in the refusal text so nobody reads a passing artifact as a good one.
 *
 * ## The binding that does the real work
 *
 * `bundleSha256` names the exact bytes the artifact was scored against,
 * `specSha256` the exact definition those bytes were rendered under, and
 * `stateSha256` (with `stateSource`) the board the captures actually opened on.
 * Publish and fork refuse when any of the three does not match what is being
 * written. So a rubric cannot be scored against revision 1 and spent on
 * revision 3, and — more importantly — the triple MUST have been through
 * preview, because preview is what prints all three into the template. A repair
 * round changes one of them, which invalidates the artifact, which forces a
 * re-preview and a re-score. That is expensive on purpose; the alternative is
 * the loop 6a measured.
 *
 * **Why three hashes and not one.** The twelve captures are a function of
 * (bundle, spec, starting state) at a fixed clock, so the sheet names all
 * three. Each was added because the ones before it were measured blind to a
 * real case:
 *
 * - The bundle hash alone missed a SPEC-only revision. A renamed title,
 *   different action copy, a `memberInteraction` claim added — every one
 *   changes what the captures show and leaves `bundleSha256` alone, so a sheet
 *   scored before the change still satisfied the binding and a definition whose
 *   cells were never rendered landed under a sheet asserting they were.
 * - Bundle plus spec still missed a SUBSTITUTED STATE. `surface preview
 *   --state <file>` renders a state the author supplies in place of
 *   `initialState`, and `RUBRIC.md` tells the scorer to do exactly that for an
 *   app whose interesting screens are not reachable by pressing buttons (the
 *   countdown template's "Passed" and "in 12 hours" appear in no other run).
 *   Preview says so loudly on stdout and said nothing the artifact could carry,
 *   so a sheet honestly filled in against a board the app never starts on was
 *   indistinguishable from one filled in against the app's own opening screen.
 *
 * The state hash is not made redundant by the spec hash even though
 * `initialState` lives in the spec: the spec hash answers "is this the same
 * definition", the state hash answers "was the renderer fed that definition's
 * own starting point or something else". They fail in different directions and
 * a change that makes one of them redundant has broken the other.
 *
 * Only a discriminator that moves with the thing it names discriminates
 * (D138), so each gets its own.
 *
 * ## The one check that carries a machine stamp as well as a note
 *
 * Check 7 — "the screen is the thing that was asked for" — has passed three
 * real defects, and every one was about what happens when you PRESS something
 * (D140). Twelve stills cannot see that, so `surface preview` now walks the
 * reachable-state graph and stamps what it found onto check 7's entry as
 * `reachability`. The scorer writes the verdict and the note; the tool writes
 * the line they are written against.
 *
 * Three shapes, and keeping them apart is the whole value:
 * `measured:` (the walk closed, and here is what it found — including
 * "nothing"), `not measured:` (it ran into a bound or could not press
 * something, so a path it never took could contradict anything it saw), and
 * `not walked:` (it never ran at all). A truncated walk that printed the same
 * thing as a clean one would be this session's own defect committed one level
 * up: silence read as a finding of nothing.
 *
 * Stamped unconditionally and REQUIRED, for the same reason `stateSha256` is:
 * a field absent in the ordinary case makes "nothing to report" and "the line
 * was deleted" the same shape, and a guard whose bypass is `delete` is not a
 * guard. What the validator checks is presence and a marker it could only have
 * written itself — never whether the sentence is any good, which is the same
 * boundary every other field here observes.
 */

import { createHash } from 'node:crypto';

import { canonicalJson } from './surface-canonical-json';

/**
 * The identity of one JSON value the twelve captures depended on — the spec,
 * or the state they were rendered from.
 *
 * ONE function for both, deliberately. A second hasher would be a second set of
 * semantics to keep in step, which is the failure D109 recorded when this
 * package held three `canonicalJson`s that disagreed about `undefined`. What is
 * hashed differs per call site; how it is hashed must not.
 *
 * **Raw to raw (D72), and the whole point is that it stays that way.** For a
 * spec the argument must be the verbatim parsed object — what `JSON.parse`
 * returns for the spec file, or what a fork derives from the source's verbatim
 * cell — never `SurfaceSpecSchema.parse(...)`'s output. `z.object` strips every
 * key it does not declare, so a hash taken over the validated view cannot see a
 * change confined to an undeclared key, and undeclared keys are exactly where
 * the gate's own opt-out markers have twice been found (D67, D72). A hash that
 * cannot see the difference it exists to detect is the D138 failure written a
 * fourth time. A state is free-form JSON with no schema to strip it, so the
 * same rule costs nothing there and is kept for one reading of the rule.
 *
 * **Why canonicalise instead of hashing the file's bytes.** The two ends of the
 * binding do not always hold the same bytes: `surface fork`'s landing pass
 * holds an in-memory object and no file at all, and a spec file re-indented
 * between preview and publish is the same definition. `canonicalJson` is the
 * one sanctioned serializer (D109) and it erases exactly two things — key order
 * and `undefined`-valued keys — neither of which survives being written to a
 * channel's description cell either. So every difference it hides is a
 * difference that cannot reach a reader, and every difference that CAN reach a
 * reader moves the hash.
 */
export function surfaceCanonicalHash(value: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex');
}

/**
 * The twelve capture cells, in the order `previewMatrix` emits them
 * (viewport, then state, then theme) so the artifact reads in the same order
 * the report prints and the rubric tells you to look.
 *
 * These are the manifest's file names without `.png`. Duplicated here rather
 * than imported from `surface-preview.ts` on purpose: `surface publish` must
 * not pull in Playwright, the shell artifact strings or the reducer to
 * validate a text file. `surface-preview.test.ts` asserts the two agree, so
 * the duplication is checked rather than hoped for.
 */
export const RUBRIC_CELL_IDS = [
  'phone-initial-light',
  'phone-initial-dark',
  'phone-populated-light',
  'phone-populated-dark',
  'phone-full-initial-light',
  'phone-full-initial-dark',
  'phone-full-populated-light',
  'phone-full-populated-dark',
  'desktop-initial-light',
  'desktop-initial-dark',
  'desktop-populated-light',
  'desktop-populated-dark',
] as const;

export type RubricCellId = (typeof RUBRIC_CELL_IDS)[number];

/**
 * The checks, named for `RUBRIC.md`'s own headings and numbered as it numbers
 * them. The ids are the stable handle; the prose lives in the rubric and is
 * not repeated here, because two copies of a checklist drift.
 *
 * Seven apply to every app. The eighth applies only to an app that declares
 * itself display-only, and it is conditional rather than universal for a
 * reason: a check every sheet has to answer becomes a check every sheet
 * answers the same way, and check 7 already demonstrated where that ends —
 * "the screen is the thing that was asked for" passed an expense split nobody
 * could add an expense to, because a screenshot of a board nobody can touch
 * looks exactly like a screenshot of a board somebody can.
 */
export const RUBRIC_CHECKS = [
  { id: 'overflow', number: 1, title: 'Nothing overflows the viewport' },
  { id: 'tap-targets', number: 2, title: 'Tap targets are reachable' },
  { id: 'themes', number: 3, title: 'Both themes are readable' },
  { id: 'empty-state', number: 4, title: 'The empty state explains itself' },
  {
    id: 'populated-scannable',
    number: 5,
    title: 'The populated state is scannable',
  },
  { id: 'no-jargon', number: 6, title: 'No mechanism vocabulary on screen' },
  {
    id: 'answers-the-request',
    number: 7,
    title: 'The screen is the thing that was asked for',
  },
  {
    id: 'display-only-was-asked-for',
    number: 8,
    title: 'Display-only is what was asked for, not what was convenient',
    /**
     * Scored only when the spec declares `memberInteraction`. The subject is
     * the `because` sentence: does the request this app answers actually want
     * a board nobody can touch, and is the host event named in `because` a
     * real one this bot will really post?
     */
    appliesWhen: 'member-interaction-declared',
  },
] as const;

export const RUBRIC_CHECK_IDS = RUBRIC_CHECKS.map(
  (check) => check.id
) as readonly string[];

/** The checks every app is scored against, whatever its spec says. */
export const UNCONDITIONAL_RUBRIC_CHECKS = RUBRIC_CHECKS.filter(
  (check) => !('appliesWhen' in check)
);

/**
 * Which checks a sheet for this spec has to carry.
 *
 * Read off the RAW spec, like the gate's own rules: a validated read would
 * have stripped an unknown key, and the point of the marker being declared in
 * the schema is that raw and validated agree — but the rubric is scored before
 * publish validates anything, so raw is the only thing there is.
 */
export function applicableRubricChecks(
  spec: unknown
): readonly (typeof RUBRIC_CHECKS)[number][] {
  const marker =
    isPlainObject(spec) && isPlainObject(spec.memberInteraction)
      ? spec.memberInteraction
      : null;
  if (marker === null) return UNCONDITIONAL_RUBRIC_CHECKS;
  return RUBRIC_CHECKS;
}

/**
 * The verdicts a check may carry.
 *
 * `fail` and `residual` are both publishable. `RUBRIC.md` says so explicitly —
 * after two repair rounds "publish anyway and say plainly what is still
 * wrong" — and a validator that refused them would push the model to write
 * `pass` over a known defect, which is worse than shipping the defect. Publish
 * echoes every non-`pass` verdict into its own output instead, so the residual
 * is on the record rather than laundered out of it (D99: an escape hatch
 * leaves an audit trail).
 */
export const RUBRIC_VERDICTS = [
  'pass',
  'fail',
  'repaired',
  'residual',
] as const;

export type RubricVerdict = (typeof RUBRIC_VERDICTS)[number];

export interface RubricCheckEntry {
  verdict: RubricVerdict;
  /** which capture cell the verdict was read off */
  cell: RubricCellId;
  note: string;
  /**
   * Check 7 only: what the reachability walk found, written by preview.
   *
   * Not the scorer's field. It is the line the verdict above is scored
   * AGAINST — the half of "the screen is the thing that was asked for" that a
   * still cannot answer. Optional on the type because seven of the eight checks
   * have nothing to cite; REQUIRED by the validator on the one that does.
   */
  reachability?: string;
}

/**
 * The check whose entry carries a `reachability` line.
 *
 * Named by id rather than by number, because the ids are the stable handle here
 * and the numbers are `RUBRIC.md`'s. `surface-rubric-artifact.test.ts` asserts
 * this id is a real check and that it is number 7, so the string is pinned
 * rather than trusted.
 */
export const REACHABILITY_CITED_CHECK = 'answers-the-request';

/**
 * How a `reachability` line may begin.
 *
 * A fixed enumeration, checked the same way `stateSource` and `verdict` are —
 * so this is not the keyword heuristic this file refuses elsewhere. The field
 * is a MACHINE stamp, and a stamp can be checked for having come from the
 * machine; a note cannot be checked for being a good note.
 *
 * The three are kept apart because the distinction is the point. `not
 * measured:` must never be able to read as `measured:` with nothing found —
 * that confusion is exactly the defect the walk exists to catch, made one level
 * up, in the artifact that records the catching.
 */
export const RUBRIC_REACHABILITY_MARKERS = [
  'measured:',
  'not measured:',
  'not walked:',
] as const;

/**
 * What the citation builder needs off a reachability report.
 *
 * Structural rather than the imported `ReachabilityReport`, and deliberately:
 * `surface publish` validates a text file and must not pull in Playwright, the
 * shell artifact strings, the reducer or happy-dom to do it — which is the same
 * reason `RUBRIC_CELL_IDS` is duplicated here rather than imported from
 * `surface-preview.ts`. `ReachabilityReport` satisfies this shape, so the
 * caller passes the report itself and no second object can disagree with it.
 */
export interface ReachabilityCitationInput {
  /** set when the walk could not run at all */
  problem?: string;
  /** every discovered state expanded, every control pressed */
  closed: boolean;
  /** states the walk reached */
  nodeCount: number;
  /** the bounds that stopped it */
  truncatedBy: readonly string[];
  /** controls it could not press, so edges it does not know it is missing */
  shortfalls: readonly string[];
  findings: readonly { message: string }[];
}

/**
 * One line, stamped onto check 7, saying what the walk established.
 *
 * The order of the branches is the order of the claims that can be made, from
 * weakest to strongest, and none of them is allowed to borrow another's words:
 * a walk that never ran says so first, a walk that stopped early says what
 * stopped it and that a path it never took could contradict anything it saw,
 * and only a closed walk gets to report a finding — including the finding that
 * there was nothing.
 */
export function reachabilityCitation(walk: ReachabilityCitationInput): string {
  const fallBack =
    'Score check 7 from the captures and the request alone, as it was scored before the walk existed';
  if (walk.problem !== undefined) {
    return `not walked: ${walk.problem}. ${fallBack}`;
  }
  if (!walk.closed) {
    const why = [...walk.truncatedBy, ...walk.shortfalls];
    return `not measured: the walk covered ${walk.nodeCount} screen(s) and stopped before it had them all (${
      why.length > 0 ? why.join('; ') : 'the walk did not finish'
    }), so a path it never took could contradict anything it saw. ${fallBack}`;
  }
  if (walk.findings.length === 0) {
    return `measured: closed over all ${walk.nodeCount} reachable screen(s) — every declared action has a control a member can press, and no value is reachable only through another`;
  }
  return `measured: closed over all ${walk.nodeCount} reachable screen(s) — ${
    walk.findings.length
  } finding(s): ${walk.findings.map((finding) => finding.message).join(' | ')}`;
}

/**
 * Where the state the twelve cells were rendered from came from.
 *
 * The same two words `manifest.json` already uses, rather than a second
 * vocabulary for the same distinction — the manifest and the sheet describe one
 * preview run and must not disagree about what it was.
 */
export const RUBRIC_STATE_SOURCES = ['spec-initial-state', 'override'] as const;

export type RubricStateSource = (typeof RUBRIC_STATE_SOURCES)[number];

export interface RubricArtifact {
  version: 1;
  surfaceId: string;
  /** sha256 of the bundle these twelve cells were rendered from */
  bundleSha256: string;
  /** `surfaceCanonicalHash` of the spec they were rendered under */
  specSha256: string;
  /** whether `--state` stood in for the spec's own `initialState` */
  stateSource: RubricStateSource;
  /**
   * `surfaceCanonicalHash` of the state the cells actually opened on — the
   * supplied one when `stateSource` is `override`, the spec's own otherwise.
   *
   * Stamped unconditionally rather than only for an override, so the
   * comparison at the other end is one equality against one always-present
   * field. A hash that is absent in the ordinary case would make "no override
   * happened" and "the field was deleted" the same shape, which is the
   * satisfiable-by-omission hole this whole binding exists to close.
   */
  stateSha256: string;
  cells: Record<string, string>;
  checks: Record<string, RubricCheckEntry>;
}

export type RubricValidation =
  | { ok: true; artifact: RubricArtifact }
  | {
      ok: false;
      code: 'rubric-unreadable' | 'rubric-incomplete';
      problems: string[];
    };

const SHA256_HEX = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The pre-filled form `surface preview` writes next to the screenshots.
 *
 * Every key the validator requires is already here, in reading order, with the
 * identity fields filled in from the render that just happened. What is left
 * for the model is nineteen strings and seven verdicts (eight, for an app
 * that declares itself display-only) — no schema to
 * remember, no hash to compute, no cell names to get right. The cheapest
 * correct emission is "open this file and fill in the blanks", so that is the
 * emission the tool asks for.
 */
export function buildRubricTemplate(input: {
  surfaceId: string;
  bundleSha256: string;
  /**
   * The RAW spec being previewed. Two jobs, and it is one argument rather than
   * two so they cannot disagree:
   *
   * - a display-only app's template carries check 8. The forcing function has
   *   to land where the author is already filling in blanks; a check that only
   *   appears at publish time is a check discovered after the work it was meant
   *   to shape.
   * - it is what `specSha256` is taken over. The stamp is computed here, from
   *   this object, rather than accepted as a second parameter — a caller that
   *   could pass a hash of something other than the spec it keyed the checks
   *   from is a caller that will eventually do it.
   *
   * Raw, never `SurfaceSpecSchema.parse(...)`'s output: see
   * `surfaceCanonicalHash`.
   */
  spec: unknown;
  /**
   * The state `--state` substituted for `initialState`, when one was
   * substituted. Absent means the cells opened on the spec's own starting
   * point.
   *
   * Passed as the state ITSELF rather than as a source flag plus a hash, for
   * the reason above: the writer derives both from one object, so a template
   * cannot claim `override` while naming the spec's state, or the reverse.
   */
  stateOverride?: unknown;
  /**
   * What the reachability walk found, for check 7's `reachability` line.
   *
   * REQUIRED, not optional. A caller that could leave it out would emit a sheet
   * the validator then refuses, which turns a compile-time mistake into a
   * publish-time one — and, worse, an optional argument is how "we did not walk
   * it" and "we walked it and it was fine" become the same emission. The report
   * itself is passed and the line derived here, for the same reason the hashes
   * are computed here rather than accepted: a caller free to describe the walk
   * in its own words is a caller that will eventually describe a different one.
   */
  reachability: ReachabilityCitationInput;
}): string {
  const cells: Record<string, string> = {};
  for (const cell of RUBRIC_CELL_IDS) {
    cells[cell] = '';
  }
  const citation = reachabilityCitation(input.reachability);
  const checks: Record<string, RubricCheckEntry> = {};
  for (const check of applicableRubricChecks(input.spec)) {
    checks[check.id] = {
      verdict: 'pass',
      cell: RUBRIC_CELL_IDS[0],
      note: '',
      ...(check.id === REACHABILITY_CITED_CHECK
        ? { reachability: citation }
        : {}),
    };
  }
  const overridden = input.stateOverride !== undefined;
  const artifact: RubricArtifact = {
    version: 1,
    surfaceId: input.surfaceId,
    bundleSha256: input.bundleSha256,
    specSha256: surfaceCanonicalHash(input.spec),
    stateSource: overridden ? 'override' : 'spec-initial-state',
    stateSha256: surfaceCanonicalHash(
      overridden ? input.stateOverride : specInitialState(input.spec)
    ),
    cells,
    checks,
  };
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

/**
 * The starting point a spec declares, read off the RAW spec.
 *
 * Exported because both ends of the state binding need the same reading of
 * "what this definition opens on" and a second reading would be a second
 * opinion — publish and fork compute the expected hash from it, and the
 * template writer stamps it when no override stood in.
 */
export function specInitialState(spec: unknown): unknown {
  return isPlainObject(spec) ? spec.initialState : undefined;
}

/**
 * Reads a rubric artifact and reports whether it is COMPLETE.
 *
 * The two failure codes are kept apart deliberately. `rubric-unreadable` means
 * the bytes are not a rubric at all — bad JSON, an array, a number. That is a
 * different repair (rewrite the file) from `rubric-incomplete`, which means
 * the shape is right and some of the work is missing (fill in these cells).
 * Collapsing them would make an incomplete artifact indistinguishable from a
 * typo, and then the test for "publish refuses an incomplete rubric" could
 * pass while only ever exercising the parser.
 */
export function validateRubricArtifact(
  raw: unknown,
  /**
   * The spec the sheet is scoring, when the caller has it. Publish does;
   * anyone checking a sheet in isolation does not, and then only the
   * unconditional checks are required — a sheet cannot be faulted for missing
   * a check nobody could tell applied.
   */
  spec?: unknown
): RubricValidation {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      code: 'rubric-unreadable',
      problems: [
        'the rubric file must contain a JSON object, and this is not one',
      ],
    };
  }

  const problems: string[] = [];

  if (raw.version !== 1) {
    problems.push(
      `"version" must be 1, and this says ${JSON.stringify(raw.version)}`
    );
  }
  if (!nonEmpty(raw.surfaceId)) {
    problems.push('"surfaceId" must be the id of the app that was scored');
  }
  if (
    typeof raw.bundleSha256 !== 'string' ||
    !SHA256_HEX.test(raw.bundleSha256)
  ) {
    problems.push(
      '"bundleSha256" must be the 64-character hash preview printed for the bundle these captures were rendered from'
    );
  }
  // REQUIRED, with no tolerance for a sheet that predates these fields.
  //
  // A missing `specSha256` (or `stateSha256`, below) is the one shape a lenient
  // reading would have to accept, and accepting it would hand every sheet ever
  // written — and every sheet anyone deletes one line out of — a permanent pass
  // on the binding. A guard whose bypass is `delete sheet.specSha256` is not a
  // guard; it is a guard-shaped thing that reads as coverage, which is worse
  // than none (D138). There is nothing honest to migrate to, either: the fields
  // are claims about what the scorer was looking at, and no tool can make such
  // a claim on a scorer's behalf after the fact. The remedy is the one a
  // changed bundle already demands — re-run `surface preview` and score what it
  // renders.
  //
  // (`surfaces-eval-probe.ts` reads historical sheets rather than gating a
  // write, and says so about a sheet that predates the fields instead of
  // reporting it as the author's error. That tolerance is correct THERE and
  // would be a loophole here; the difference is reader versus gate.)
  if (typeof raw.specSha256 !== 'string' || !SHA256_HEX.test(raw.specSha256)) {
    problems.push(
      '"specSha256" must be the 64-character hash preview printed for the spec these captures were rendered under — a sheet written before publish bound the spec carries no such field, and re-running `surface preview` is what writes it'
    );
  }
  if (
    typeof raw.stateSource !== 'string' ||
    !(RUBRIC_STATE_SOURCES as readonly string[]).includes(raw.stateSource)
  ) {
    problems.push(
      `"stateSource" must be ${RUBRIC_STATE_SOURCES.join(' or ')}, saying whether \`--state\` stood in for the spec's own starting point when these captures were rendered`
    );
  }
  if (
    typeof raw.stateSha256 !== 'string' ||
    !SHA256_HEX.test(raw.stateSha256)
  ) {
    problems.push(
      '"stateSha256" must be the 64-character hash preview printed for the state these captures opened on — a sheet written before publish bound the state carries no such field, and re-running `surface preview` is what writes it'
    );
  }

  const cellValues: string[] = [];
  const cells = raw.cells;
  if (!isPlainObject(cells)) {
    problems.push('"cells" must be an object with one entry per capture cell');
  } else {
    const missing = RUBRIC_CELL_IDS.filter((id) => !nonEmpty(cells[id]));
    const extra = Object.keys(cells).filter(
      (key) => !(RUBRIC_CELL_IDS as readonly string[]).includes(key)
    );
    if (missing.length > 0) {
      problems.push(
        `${missing.length} of the twelve capture cells have no observation: ${missing.join(', ')}`
      );
    }
    if (extra.length > 0) {
      problems.push(
        `"cells" names ${extra.length} thing(s) that are not capture cells: ${extra.join(', ')}`
      );
    }
    for (const id of RUBRIC_CELL_IDS) {
      const value = cells[id];
      if (nonEmpty(value)) cellValues.push(value.trim());
    }
  }

  // The one structural anti-degeneracy check. Twelve copies of "ok" is one
  // observation written down twelve times; comparing the strings to each
  // other says so without judging any of them. Twelve DIFFERENT weak
  // sentences still pass, and the refusal text says as much.
  if (
    cellValues.length === RUBRIC_CELL_IDS.length &&
    new Set(cellValues).size === 1
  ) {
    problems.push(
      'all twelve cell observations are the same string, which is one observation recorded twelve times rather than twelve cells looked at'
    );
  }

  if (!isPlainObject(raw.checks)) {
    problems.push('"checks" must be an object with one entry per rubric check');
  } else {
    const extra = Object.keys(raw.checks).filter(
      (key) => !RUBRIC_CHECK_IDS.includes(key)
    );
    if (extra.length > 0) {
      problems.push(
        `"checks" names ${extra.length} thing(s) that are not rubric checks: ${extra.join(', ')}`
      );
    }
    for (const check of applicableRubricChecks(spec)) {
      const entry = raw.checks[check.id];
      if (!isPlainObject(entry)) {
        problems.push(
          `check ${check.number} (${check.id}) — "${check.title}" — was not scored`
        );
        continue;
      }
      if (
        typeof entry.verdict !== 'string' ||
        !(RUBRIC_VERDICTS as readonly string[]).includes(entry.verdict)
      ) {
        problems.push(
          `check ${check.number} (${check.id}) needs a "verdict" of ${RUBRIC_VERDICTS.join(', ')}`
        );
      }
      if (
        typeof entry.cell !== 'string' ||
        !(RUBRIC_CELL_IDS as readonly string[]).includes(entry.cell)
      ) {
        problems.push(
          `check ${check.number} (${check.id}) needs a "cell" naming the capture it was scored on`
        );
      }
      if (!nonEmpty(entry.note)) {
        problems.push(
          `check ${check.number} (${check.id}) needs a "note" saying what you saw`
        );
      }
      // Check 7 alone, and REQUIRED there. The line is preview's, not the
      // scorer's: it is what the verdict above is scored against, and a sheet
      // that lost it is a sheet whose check 7 was scored from stills — which is
      // how the same defect got through three times (D140). There is nothing to
      // migrate an older sheet to, for the reason the hashes above give: no tool
      // can claim on a scorer's behalf what they were looking at.
      if (check.id === REACHABILITY_CITED_CHECK) {
        if (!nonEmpty(entry.reachability)) {
          problems.push(
            `check ${check.number} (${check.id}) needs the "reachability" line \`surface preview\` stamps on it, saying what the walk over the reachable screens found — re-run \`surface preview\` and score the sheet it writes`
          );
        } else if (
          !RUBRIC_REACHABILITY_MARKERS.some((marker) =>
            (entry.reachability as string).trimStart().startsWith(marker)
          )
        ) {
          problems.push(
            `check ${check.number} (${check.id}) has a "reachability" line that did not come from \`surface preview\`: it must begin with ${RUBRIC_REACHABILITY_MARKERS.map(
              (marker) => `"${marker}"`
            ).join(
              ', '
            )}, which is how a walk that was TRUNCATED stays distinguishable from one that closed and found nothing`
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    return { ok: false, code: 'rubric-incomplete', problems };
  }
  return { ok: true, artifact: raw as unknown as RubricArtifact };
}

/** The non-`pass` verdicts, for publish's audit trail. */
export function rubricResiduals(
  artifact: RubricArtifact
): { id: string; number: number; verdict: RubricVerdict; note: string }[] {
  const residuals: {
    id: string;
    number: number;
    verdict: RubricVerdict;
    note: string;
  }[] = [];
  for (const check of RUBRIC_CHECKS) {
    const entry = artifact.checks[check.id];
    if (entry && entry.verdict !== 'pass') {
      residuals.push({
        id: check.id,
        number: check.number,
        verdict: entry.verdict,
        note: entry.note,
      });
    }
  }
  return residuals;
}
