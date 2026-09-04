/**
 * The witness's own tests, run by `pnpm test` alongside
 * `preflight-assertions.test.mjs`.
 *
 * Every fixture here is REAL: the spec, recipe and painted text below were
 * read off `chat/~zod/dash-ir6lyyyt` with `tlon surface show` and
 * `dev/surfaces-render-probe.ts` on 2026-09-01, and are pasted verbatim,
 * concatenation artifacts included ("1responses1 person still to respond" is
 * what `root.textContent` returns when a stat's value and its label are
 * adjacent text nodes). Synthetic fixtures would prove the lattice branches
 * and nothing about whether the surfaces it reads look the way it thinks they
 * do — which is the half that broke in 6a.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VERDICT,
  actionSearchText,
  buildActionFields,
  compilePatterns,
  decide,
  mayIssue,
  selfTestPatterns,
} from './surfaces-witness.mjs';

/* ------------------------------------------------------------------ */
/* Real fixtures                                                       */
/* ------------------------------------------------------------------ */

/** chat/~zod/dash-ir6lyyyt, revision 2, verbatim. */
const RSVP_ACTIONS = {
  'rsvp-coming': {
    ops: [{ op: 'set', path: '/entries/$actor', value: 'coming' }],
  },
  'rsvp-maybe': {
    ops: [{ op: 'set', path: '/entries/$actor', value: 'maybe' }],
  },
  'rsvp-absent': {
    ops: [{ op: 'set', path: '/entries/$actor', value: 'absent' }],
  },
};

const RSVP_RECIPE =
  "An RSVP board for a book club meetup. Members choose Coming, Maybe, or Can't make it. " +
  "The board shows each member's response and explicitly lists members who have not responded yet.";

/** phone-initial-light, at the channel's live reduced state. */
const RSVP_PAINTED =
  "Are you coming to the book club meetup?1responses1 person still to respondYour RSVPComingMaybeCan't make itResponses~zodComingNot responded yet~tenNot responded";

const RSVP_RENDER = {
  ok: true,
  unprobedCells: [],
  cells: [
    {
      cell: 'phone-initial-light',
      text: RSVP_PAINTED,
      controls: ['Coming', 'Maybe', "Can't make it"],
    },
  ],
};

/** The witness for "show who hasn't responded yet". */
const NONRESPONDER_WITNESS = {
  renderPatterns: [
    'not\\s*responded',
    'no\\s*(response|reply) (yet|from)',
    '(still|yet) to (respond|reply|answer)',
    '(waiting|pending) on',
    "haven'?t (responded|replied|answered)",
  ],
  renderPositive: 'Not responded yet~tenNot responded',
  renderNegatives: [
    'Are you coming to the book club meetup?',
    "Your RSVPComingMaybeCan't make it",
    'Responses~zodComing',
  ],
  actionPatterns: ['respond', 'pending', 'absent', 'no-?reply'],
  actionPositive:
    'mark-not-responded {"ops":[{"op":"set","path":"/pending/$actor"}]}',
  actionNegatives: [
    'add-expense {"ops":[{"op":"set","path":"/expenses/$actor","value":0}]}',
    'move-card-doing {"ops":[{"op":"set","path":"/cards/$id/column","value":"doing"}]}',
  ],
};

/* ------------------------------------------------------------------ */
/* compilePatterns                                                     */
/* ------------------------------------------------------------------ */

test('an empty pattern list is a problem, not an empty result', () => {
  const { compiled, problems } = compilePatterns([], 'renderPatterns');
  assert.equal(compiled.length, 0);
  assert.match(problems[0], /could only ever find nothing/);
});

test('a pattern that matches the empty string is refused', () => {
  const { problems } = compilePatterns(['a*'], 'renderPatterns');
  assert.match(problems[0], /matches the empty string/);
});

test('an uncompilable pattern is reported, not thrown', () => {
  const { problems } = compilePatterns(['(unclosed'], 'renderPatterns');
  assert.match(problems[0], /does not compile/);
});

/* ------------------------------------------------------------------ */
/* The two-sided self-test — the anti-vacuity core                     */
/* ------------------------------------------------------------------ */

test('a pattern set that misses its positive example is rejected as vacuous', () => {
  const result = selfTestPatterns({
    patterns: ['zzz-nothing-like-this'],
    positive: 'Not responded yet',
    negatives: ['Responses~zodComing'],
    label: 'renderPatterns',
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((f) => /cannot recognise the behaviour/.test(f))
  );
});

test('a pattern set that matches its negative example is rejected as indiscriminate', () => {
  // The classic bad grep: search the word the app happens to use everywhere.
  const result = selfTestPatterns({
    patterns: ['respond'],
    positive: 'Not responded yet',
    negatives: ['1responses1 person still to respond'],
    label: 'renderPatterns',
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => /does not discriminate/.test(f)));
});

test('a witness with no negative examples cannot rule out matching everything', () => {
  const result = selfTestPatterns({
    patterns: ['not\\s*responded'],
    positive: 'Not responded yet',
    negatives: [],
    label: 'renderPatterns',
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => /matches everything/.test(f)));
});

test('a witness that discriminates passes and records which pattern did it', () => {
  const result = selfTestPatterns({
    patterns: NONRESPONDER_WITNESS.renderPatterns,
    positive: NONRESPONDER_WITNESS.renderPositive,
    negatives: NONRESPONDER_WITNESS.renderNegatives,
    label: 'renderPatterns',
  });
  assert.equal(result.ok, true, result.failures.join('\n'));
  assert.equal(result.positiveMatchedBy, 'not\\s*responded');
});

/* ------------------------------------------------------------------ */
/* The action map                                                      */
/* ------------------------------------------------------------------ */

test('an action is searched by its id AND its ops, not its id alone', () => {
  const text = actionSearchText('a3', RSVP_ACTIONS['rsvp-absent']);
  assert.match(text, /absent/);
  const fields = buildActionFields(RSVP_ACTIONS);
  assert.equal(fields.length, 3);
  assert.equal(fields[0].where, 'spec.actions["rsvp-coming"]');
});

/* ------------------------------------------------------------------ */
/* The lattice                                                         */
/* ------------------------------------------------------------------ */

test('the real book-club board REFUSES "who hasn\'t responded yet"', () => {
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: { actions: RSVP_ACTIONS },
    recipe: RSVP_RECIPE,
    render: RSVP_RENDER,
    bundleSource: 'const pending = people.filter(...)',
  });
  assert.equal(decision.verdict, VERDICT.present);
  assert.equal(mayIssue(decision), false);
  // Cited to the painted screen, not to the recipe's prose alone.
  assert.ok(decision.findings.renderHit);
  assert.match(decision.findings.renderHit.match, /Not responded/i);
  assert.ok(decision.findings.recipeHit);
});

test('the same witness PASSES against a board that paints no such thing', () => {
  // A poll with the same three-option shape and no pending list anywhere.
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: {
      actions: {
        'vote-a': { ops: [{ op: 'set', path: '/votes/$actor', value: 'a' }] },
      },
    },
    recipe:
      'A poll for Friday movie night with three options and a vote tally.',
    render: {
      ok: true,
      unprobedCells: [],
      cells: [
        {
          cell: 'phone-initial-light',
          text: 'Friday movie night2votesDuneArrivalHeatVotes~zodDune~tenArrival',
          controls: ['Dune', 'Arrival', 'Heat'],
        },
      ],
    },
    bundleSource: 'const tally = options.map(...)',
  });
  assert.equal(decision.verdict, VERDICT.absent);
  assert.equal(mayIssue(decision), true);
});

test('an action in the map is enough on its own to refuse', () => {
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: {
      actions: {
        a7: { ops: [{ op: 'set', path: '/pending/$actor', value: true }] },
      },
    },
    recipe: 'A board.',
    render: {
      ok: true,
      unprobedCells: [],
      cells: [{ cell: 'c', text: 'x', controls: [] }],
    },
    bundleSource: 'x',
  });
  assert.equal(decision.verdict, VERDICT.present);
  assert.ok(decision.findings.actionHit);
});

test('a control label alone is enough to refuse', () => {
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: { actions: {} },
    recipe: 'A board.',
    render: {
      ok: true,
      unprobedCells: [],
      cells: [
        {
          cell: 'c',
          text: 'nothing here',
          controls: ['Show still to respond'],
        },
      ],
    },
    bundleSource: 'x',
  });
  assert.equal(decision.verdict, VERDICT.present);
  assert.match(decision.findings.renderHit.where, /controls/);
});

test('source-only is ABSTAIN, never a pass and never a refusal', () => {
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: { actions: {} },
    recipe: 'A board.',
    render: {
      ok: true,
      unprobedCells: [],
      cells: [{ cell: 'c', text: 'Friday movie night', controls: [] }],
    },
    // Coded, but behind a condition that does not hold at this state.
    bundleSource: 'if (pending.length) { return html`Not responded yet`; }',
  });
  assert.equal(decision.verdict, VERDICT.abstain);
  assert.equal(decision.reason, 'source-only');
  assert.equal(mayIssue(decision), false);
});

test('an unprobed cell abstains rather than reporting absence', () => {
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: { actions: {} },
    recipe: '',
    render: {
      ok: true,
      cells: [{ cell: 'c', text: 'nothing', controls: [] }],
      unprobedCells: [
        { cell: 'desktop-populated-dark', problem: 'no frame reported an app' },
      ],
    },
    bundleSource: '',
  });
  assert.equal(decision.verdict, VERDICT.abstain);
  assert.equal(decision.reason, 'render-incomplete');
});

test('a failed render abstains without reading any surface', () => {
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: { actions: RSVP_ACTIONS },
    recipe: RSVP_RECIPE,
    render: { ok: false, message: 'chromium is not installed' },
    bundleSource: '',
  });
  assert.equal(decision.verdict, VERDICT.abstain);
  assert.equal(decision.reason, 'render-unavailable');
  assert.deepEqual(decision.findings, {});
});

test('a witness that fails its self-test abstains before anything is read', () => {
  const decision = decide({
    // `respons` matches the declared near-miss `Responses~zodComing`, which is
    // the section heading over the people who HAVE answered.
    witness: { ...NONRESPONDER_WITNESS, renderPatterns: ['respons'] },
    spec: { actions: RSVP_ACTIONS },
    recipe: RSVP_RECIPE,
    render: RSVP_RENDER,
    bundleSource: '',
  });
  assert.equal(decision.verdict, VERDICT.abstain);
  assert.equal(decision.reason, 'witness-failed-self-test');
  assert.deepEqual(decision.findings, {});
});

test('the evidence quotes context, because a bare span out of painted text is unreadable', () => {
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: { actions: RSVP_ACTIONS },
    recipe: RSVP_RECIPE,
    render: RSVP_RENDER,
    bundleSource: '',
  });
  const hit = decision.findings.renderHit;
  assert.ok(hit.context.length > hit.match.length);
  assert.match(hit.context, /Responses~zodComing/);
  assert.equal(hit.where, 'render[phone-initial-light].text');
});

/**
 * The source check searched with the PROSE set only, and for at least one real
 * request that made it inert.
 *
 * `rev-poll-cant-make-it`'s render patterns all required a literal space
 * (`can.?t make it`); the only occurrence in the app that demonstrably HAD the
 * behaviour was the identifier `'cant-make-it'`. So the check reported "the
 * bundle source does not mention it" without being able to mention it, and the
 * one net under "coded but not currently painted" was missing for that request.
 * Found by a spot audit of the verdict run's pre-states, not by this suite.
 *
 * The fixture reproduces both halves: identifier-shaped source (only the action
 * patterns can reach it) and prose-shaped source (only the render patterns can).
 */
test('the source check reads identifier-shaped source, not only prose', () => {
  const identifierOnly = decide({
    witness: NONRESPONDER_WITNESS,
    spec: { actions: {} },
    recipe: 'A board.',
    render: {
      ok: true,
      unprobedCells: [],
      cells: [{ cell: 'c', text: 'Friday movie night', controls: [] }],
    },
    // No prose pattern can match this: every one of them needs whitespace or a
    // word the slug does not spell out.
    bundleSource: "const VOTE = { 'mark-pending': () => invoke('pending') };",
  });
  assert.equal(identifierOnly.verdict, VERDICT.abstain);
  assert.equal(identifierOnly.reason, 'source-only');
  assert.match(identifierOnly.findings.sourceHit.pattern, /pending/);
});

test('widening the source check cannot turn an absence into a presence', () => {
  // The direction that makes the union safe without a further self-test: a
  // source hit produces ABSTAIN, so over-matching costs a candidate request and
  // can never manufacture a PRESENT or corrupt an issued observation.
  const decision = decide({
    witness: NONRESPONDER_WITNESS,
    spec: { actions: {} },
    recipe: 'A board.',
    render: {
      ok: true,
      unprobedCells: [],
      cells: [{ cell: 'c', text: 'Friday movie night', controls: [] }],
    },
    bundleSource: "const a = { 'mark-pending': 1 };",
  });
  assert.notEqual(decision.verdict, VERDICT.present);
  assert.equal(mayIssue(decision), false);
});
