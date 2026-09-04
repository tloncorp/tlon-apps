/**
 * The witness: how "this app does not already do X" is decided, and why it is
 * not a keyword grep.
 *
 * ## The failure this exists to make impossible
 *
 * Session 6a.5 issued five revision requests and four of them were ALREADY
 * SATISFIED before the run. The loop correctly no-opped, and an empty
 * regeneration column was read as evidence about the format when it was
 * evidence about the requests. The requests had been landed by 6a's own
 * revisions, and — this is the part that matters here — a naive check of the
 * spec's action map would have passed every one of them, because the
 * satisfaction was in the RENDER. `srf-book-club-rsvp` declares exactly three
 * actions (`rsvp-coming`, `rsvp-maybe`, `rsvp-absent`) and none of them is
 * "list who has not responded"; the board lists them anyway, from a derived
 * `pending` array, under a section header reading "Not responded yet".
 *
 * So absence has to be asserted against more than one surface, and the render
 * has to be one of them.
 *
 * ## Why this is not a keyword grep
 *
 * A grep fails in both directions and the project has already been bitten by
 * both shapes of vacuity, so "matches everything" and "matches nothing" both
 * have to be made to fail LOUDLY rather than silently.
 *
 * Four things do that work:
 *
 * **1. The search surface is the painted screen, not the source.** The text
 * searched comes from `dev/surfaces-render-probe.ts`, which renders the app in
 * the production shell in headless Chromium and reads the text nodes a browser
 * actually painted, at three viewports, both themes, at the channel's live
 * reduced state and at that state with every declared action folded through.
 * Source is searched too, but source may only ever ABSTAIN (see the lattice
 * below), never pass and never refuse: a bundle can name a concept it never
 * paints and paint a concept it never names. It is searched with BOTH pattern
 * sets — source is neither prose nor an action map but a mixture, and searching
 * it with the prose set alone made the check inert for at least one real
 * request (see the note at the `sourceHit` line).
 *
 * **2. Every witness must survive a two-sided self-test before it is used at
 * all.** The author supplies, per surface, a `positive` string that an app
 * WITH the behaviour would produce and one or more `negative` strings drawn
 * VERBATIM from the target's own current output — the near-misses that could
 * fool a lazy pattern. A pattern set that does not match the positive is
 * rejected as vacuous ("matches nothing"); a pattern set that matches any
 * negative is rejected as indiscriminate ("matches everything"). The self-test
 * runs first and its failure is an ABSTAIN, not a pass. This is the property
 * that makes the preflight capable of failing.
 *
 * **3. The action map gets its own pattern list and its own self-test.** A
 * single prose pattern list applied to action ids would match nothing, ever,
 * and "no action provides it" would be true by construction — which is 6a.5's
 * defect wearing a preflight's clothes. So `actionPatterns` is separate,
 * required, and separately self-tested against a positive example.
 *
 * **4. Absence requires unanimity; presence requires only one voice.** The
 * lattice below has exactly one row that lets a request be issued.
 *
 * ## The lattice
 *
 *   render could not be produced, or any cell went unprobed → ABSTAIN
 *   the witness failed its own self-test                    → ABSTAIN
 *   an action's id or ops match                             → PRESENT
 *   the recipe claims it                                    → PRESENT
 *   any cell painted it, or any control is labelled it      → PRESENT
 *   only the bundle SOURCE matches                          → ABSTAIN
 *   nothing matched anywhere                                → ABSENT  ← the only pass
 *
 * PRESENT and ABSTAIN are both refusals as far as the harness is concerned:
 * the request is replaced, not waved through. They are kept distinct in the
 * evidence because they mean different things to a human reading it — PRESENT
 * says "pick a different behaviour", ABSTAIN says "I could not tell, look
 * yourself".
 *
 * The source-only row is the deliberate answer to the ambiguous case. A
 * behaviour that is coded but conditionally unpainted (an `if (owed.length)`
 * that is false at the current state) is exactly the situation where the loop
 * would open its own bundle, find the feature, and correctly no-op — and
 * calling that ABSENT would manufacture the 6a.5 result all over again.
 * Refusing to judge is the honest verdict and it says so by name.
 *
 * ## What this cannot do, stated rather than papered over
 *
 * The witness is author-supplied. The self-test proves a pattern set separates
 * two named strings; it does not prove the pattern set is the RIGHT one for the
 * behaviour, and no test of a pattern against examples ever could. What the
 * self-test buys is that a vacuous or universal pattern cannot be used
 * silently. Judgment about whether the pattern names the behaviour stays with
 * the author, and the evidence file quotes everything needed to second-guess
 * it.
 *
 * The error budget is deliberately asymmetric, and the design leans on it. A
 * witness that is too BROAD refuses a request that was genuinely unsatisfied —
 * the request gets replaced, and the run loses one candidate. A witness that is
 * too NARROW passes a request the app already satisfies — which is 6a.5,
 * exactly, and costs the whole measurement. So when in doubt, broaden: the
 * cheap error is the one to make. The self-test's negative examples are what
 * stop broadening from running all the way to a preflight that refuses
 * everything, which is the other vacuity.
 */

/** A pattern that can match the empty string matches every surface trivially. */
function matchesEmpty(regex) {
  return new RegExp(regex.source, regex.flags.replace('g', '')).test('');
}

export function compilePatterns(patterns, label) {
  const problems = [];
  const compiled = [];
  if (!Array.isArray(patterns) || patterns.length === 0) {
    problems.push(
      `${label}: no patterns given, so the check could only ever find nothing`
    );
    return { compiled, problems };
  }
  for (const source of patterns) {
    if (typeof source !== 'string' || source.trim() === '') {
      problems.push(`${label}: ${JSON.stringify(source)} is not a pattern`);
      continue;
    }
    let regex;
    try {
      regex = new RegExp(source, 'i');
    } catch (error) {
      problems.push(
        `${label}: /${source}/ does not compile (${error instanceof Error ? error.message : String(error)})`
      );
      continue;
    }
    if (matchesEmpty(regex)) {
      problems.push(
        `${label}: /${source}/ matches the empty string, so it matches every surface and discriminates nothing`
      );
      continue;
    }
    compiled.push(regex);
  }
  return { compiled, problems };
}

/**
 * The matched span with enough on either side to recognise where it came from.
 *
 * Painted text arrives whitespace-collapsed and with NO separator between
 * adjacent text nodes — `root.textContent` concatenates, so a stat reading "1"
 * above a label reading "responses" arrives as `1responses`. Context is quoted
 * generously for that reason: a bare span out of concatenated text is often
 * unreadable, and a human checking this evidence has to be able to see what
 * the pattern actually landed on.
 */
export function quoteMatch(haystack, regex, pad = 70) {
  const found = regex.exec(haystack);
  if (!found) return null;
  const at = found.index;
  const from = Math.max(0, at - pad);
  const to = Math.min(haystack.length, at + found[0].length + pad);
  return {
    pattern: regex.source,
    match: found[0],
    index: at,
    context:
      (from > 0 ? '…' : '') +
      haystack.slice(from, to) +
      (to < haystack.length ? '…' : ''),
  };
}

/** First hit across a list of named strings, or null. */
function firstHit(fields, compiled) {
  for (const field of fields) {
    for (const regex of compiled) {
      const quoted = quoteMatch(field.text, regex);
      if (quoted) return { where: field.where, ...quoted };
    }
  }
  return null;
}

/**
 * The two-sided self-test. Runs BEFORE anything is read off the ship, so a
 * malformed witness costs no render.
 */
export function selfTestPatterns({ patterns, positive, negatives, label }) {
  const { compiled, problems } = compilePatterns(patterns, label);
  const failures = [...problems];

  if (typeof positive !== 'string' || positive.trim() === '') {
    failures.push(
      `${label}: no positive example, so "matches nothing" could not be ruled out`
    );
  }
  if (!Array.isArray(negatives) || negatives.length === 0) {
    failures.push(
      `${label}: no negative examples, so "matches everything" could not be ruled out. ` +
        "Draw at least one verbatim from the target's own current output — the near-miss a lazy pattern would trip on."
    );
  }

  const positiveHit =
    compiled.length > 0 && typeof positive === 'string'
      ? firstHit([{ where: `${label}.positive`, text: positive }], compiled)
      : null;
  if (compiled.length > 0 && typeof positive === 'string' && !positiveHit) {
    failures.push(
      `${label}: no pattern matches the positive example ${JSON.stringify(positive)} — ` +
        'the pattern set cannot recognise the behaviour it is supposed to detect'
    );
  }

  const negativeHits = [];
  if (Array.isArray(negatives)) {
    for (const negative of negatives) {
      if (typeof negative !== 'string') continue;
      const hit = firstHit(
        [{ where: `${label}.negative`, text: negative }],
        compiled
      );
      if (hit) {
        negativeHits.push({ negative, ...hit });
        failures.push(
          `${label}: /${hit.pattern}/ matches the negative example ${JSON.stringify(negative)} ` +
            `at ${JSON.stringify(hit.match)} — the pattern does not discriminate`
        );
      }
    }
  }

  return {
    ok: failures.length === 0,
    label,
    patterns: Array.isArray(patterns) ? patterns : [],
    positive: typeof positive === 'string' ? positive : null,
    positiveMatchedBy: positiveHit ? positiveHit.pattern : null,
    positiveMatch: positiveHit ? positiveHit.match : null,
    negatives: Array.isArray(negatives) ? negatives : [],
    negativeHits,
    failures,
    compiled,
  };
}

/**
 * The searchable text of one action.
 *
 * Id AND body: `rsvp-absent` carries the concept in its slug, and
 * `{"op":"set","path":"/entries/$actor","value":"absent"}` carries it in the
 * value. An action map check that read only the ids would miss an action whose
 * id is `a3` — and ids like that are exactly what a regenerating model emits.
 */
export function actionSearchText(id, definition) {
  return `${id} ${JSON.stringify(definition)}`;
}

export function buildActionFields(actions) {
  const entries = Object.entries(actions ?? {});
  return entries.map(([id, definition]) => ({
    where: `spec.actions["${id}"]`,
    text: actionSearchText(id, definition),
  }));
}

export function buildRenderFields(cells) {
  const fields = [];
  for (const cell of cells ?? []) {
    fields.push({ where: `render[${cell.cell}].text`, text: cell.text ?? '' });
    for (const [i, control] of (cell.controls ?? []).entries()) {
      fields.push({
        where: `render[${cell.cell}].controls[${i}]`,
        text: control ?? '',
      });
    }
  }
  return fields;
}

export const VERDICT = {
  absent: 'absent',
  present: 'present',
  abstain: 'abstain',
};

/**
 * Decide, given every surface already gathered. Pure: no IO, no clock, no
 * process. The driver does the reading; this does the judging, so the judging
 * is testable without a ship or a browser.
 */
export function decide({ witness, spec, recipe, render, bundleSource }) {
  const renderTest = selfTestPatterns({
    patterns: witness.renderPatterns,
    positive: witness.renderPositive,
    negatives: witness.renderNegatives,
    label: 'renderPatterns',
  });
  const actionTest = selfTestPatterns({
    patterns: witness.actionPatterns,
    positive: witness.actionPositive,
    negatives: witness.actionNegatives,
    label: 'actionPatterns',
  });

  const selfTest = {
    ok: renderTest.ok && actionTest.ok,
    render: renderTest,
    actions: actionTest,
  };

  if (!selfTest.ok) {
    return {
      verdict: VERDICT.abstain,
      reason: 'witness-failed-self-test',
      explanation:
        'The witness could not be shown to discriminate, so nothing was read off the ship. ' +
        'A pattern set that matches its own negative example, or misses its own positive one, ' +
        'cannot answer whether the app already does this.',
      selfTest,
      findings: {},
    };
  }

  // Render availability is checked before any absence is claimed. "Measured,
  // found nothing" and "could not measure" must never render the same — the
  // exact doctrine `surface preview`'s own unprobed-cell list is built on.
  if (!render || !render.ok) {
    return {
      verdict: VERDICT.abstain,
      reason: 'render-unavailable',
      explanation:
        'The app could not be rendered, so whether it already paints this is unknown. ' +
        (render?.message ? `The renderer said: ${render.message}` : ''),
      selfTest,
      findings: {},
    };
  }
  if ((render.unprobedCells ?? []).length > 0) {
    return {
      verdict: VERDICT.abstain,
      reason: 'render-incomplete',
      explanation:
        `${render.unprobedCells.length} of the rendered cells could not be measured, so a cell ` +
        'this app paints the behaviour in may not have been read.',
      selfTest,
      findings: { unprobedCells: render.unprobedCells },
    };
  }
  if ((render.cells ?? []).length === 0) {
    return {
      verdict: VERDICT.abstain,
      reason: 'render-incomplete',
      explanation: 'The renderer produced no measured cells at all.',
      selfTest,
      findings: {},
    };
  }

  const actionFields = buildActionFields(spec?.actions);
  const renderFields = buildRenderFields(render.cells);
  const recipeFields =
    typeof recipe === 'string' && recipe.length > 0
      ? [{ where: 'spec.recipe', text: recipe }]
      : [];
  const sourceFields =
    typeof bundleSource === 'string' && bundleSource.length > 0
      ? [{ where: 'bundle source', text: bundleSource }]
      : [];

  const actionHit = firstHit(actionFields, actionTest.compiled);
  const recipeHit = firstHit(recipeFields, renderTest.compiled);
  const renderHit = firstHit(renderFields, renderTest.compiled);
  // BOTH pattern sets, against the source. The prose set alone was a vacuous
  // check, and it was caught by a spot audit rather than by anything here: for
  // `rev-poll-cant-make-it` the render patterns all required a literal space
  // (`can.?t make it`) while the only occurrence in the post-state bundle was
  // the identifier `'cant-make-it'`, so the source check could not have fired
  // even on the app that demonstrably had the behaviour — and the evidence
  // sheet said "the bundle source does not mention it" as though it had looked.
  // The requests README already names this failure for the action surface ("a
  // prose pattern applied to an action map matches nothing ever"); source is
  // neither prose nor an action map but a mixture of both, and it needs both.
  //
  // Widening here cannot corrupt a measurement, only cost a candidate: a source
  // hit produces ABSTAIN and never PRESENT, so a pattern that over-matches
  // turns an issuable request into a refused one. That direction is the safe
  // one, which is why the union is not gated on a further self-test — each
  // list is separately self-tested, and their union is only ever consulted
  // for a refusal.
  const sourceHit = firstHit(sourceFields, [
    ...renderTest.compiled,
    ...actionTest.compiled,
  ]);

  const findings = { actionHit, recipeHit, renderHit, sourceHit };

  if (actionHit || recipeHit || renderHit) {
    const which = [
      actionHit ? 'an action in the map provides it' : null,
      recipeHit ? 'the recipe already claims it' : null,
      renderHit ? 'the app already paints it' : null,
    ].filter(Boolean);
    return {
      verdict: VERDICT.present,
      reason: 'already-satisfied',
      explanation: `This request is already satisfied: ${which.join('; ')}.`,
      selfTest,
      findings,
    };
  }

  if (sourceHit) {
    return {
      verdict: VERDICT.abstain,
      reason: 'source-only',
      explanation:
        'The bundle SOURCE matches but nothing painted it at any state or viewport measured. ' +
        'That is the ambiguous case: the behaviour may be coded behind a condition that does not ' +
        'currently hold, in which case a reviser reading its own bundle would find the feature and ' +
        'correctly no-op. Source alone is not evidence of absence and is not treated as evidence of ' +
        'presence either, so this abstains.',
      selfTest,
      findings,
    };
  }

  return {
    verdict: VERDICT.absent,
    reason: 'unsatisfied',
    explanation:
      'No action in the map provides it, the recipe does not claim it, no cell painted it, ' +
      'no control is labelled for it, and the bundle source does not mention it.',
    selfTest,
    findings,
  };
}

/** Refusals and passes, for a caller that only needs the one bit. */
export function mayIssue(decision) {
  return decision.verdict === VERDICT.absent;
}
