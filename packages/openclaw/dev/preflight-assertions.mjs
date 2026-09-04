/**
 * Pure assertions for the two harness preflights. No I/O, no docker, no
 * network — so they can be exercised against recorded evidence from the
 * conditions they exist to catch (see preflight-assertions.test.mjs).
 *
 * Both are session-6a findings converted into controls:
 *
 *  1. D111 — the run model's image support is NOT what `openclaw models list`
 *     says. The cached OpenRouter catalogue carries only the `-pro` variant of
 *     the run model, so the catalogue reports `input: text` while the runtime
 *     accepts images. If the two ever agreed, every preview would arrive as a
 *     placeholder string and NO ERROR WOULD BE RAISED — the loop would score
 *     its rubric against text saying the image was omitted. This makes that an
 *     error.
 *
 *  2. D112 — the dev container delivered zero Tlon skills to the model while
 *     every file was present on disk, because core rejects a plugin skill whose
 *     realpath leaves the plugin root. An assertion about EXISTENCE proves
 *     nothing when the bug is that existing things are rejected. The only
 *     assertion that discriminates is the model's own system prompt listing the
 *     skill, which is what `systemPromptReport.skills.entries` reports.
 */

/**
 * Every placeholder openclaw core can substitute for an image, verbatim, as
 * grepped out of openclaw 2026.5.28's dist. Two mechanisms produce them:
 *
 *   - transform-messages.ts substitutes the PARENTHESISED pair when the
 *     resolved model's `input` does not include "image" (this is the pair
 *     D111's negative control observed);
 *   - the tool-result builders substitute the BRACKETED forms when the
 *     read tool declines to attach, or when a resize could not get the image
 *     under the inline size limit.
 *
 * D111 says "the four placeholder strings" without enumerating them. Six
 * distinct literals exist in core; the superset is used here deliberately —
 * a placeholder this list misses is a silent pass, which is the exact failure
 * shape the control exists to prevent.
 */
export const IMAGE_PLACEHOLDERS = [
  '(image omitted: model does not support images)',
  '(tool image omitted: model does not support images)',
  '[image omitted]',
  '[tool image omitted: model does not support images]',
  '[Current model does not support images. The image will be omitted from this request.]',
  '[Image omitted: could not be resized below the inline image size limit.]',
];

/** Digits only, so a vision misread cannot be confused with a glyph ambiguity. */
export const PROBE_TOKEN_LENGTH = 16;

/**
 * Calibrated against two REAL misreads, not chosen a priori:
 *
 *   - D111: `£5d49e9816dd21c9` returned against `f5d49e9816dd21c9` — one
 *     character wrong, and that imperfection was the evidence, because a text
 *     leak would have been byte-perfect;
 *   - 2026-09-01, marker `preflight-mtioxds9`: `3146969866461787` returned
 *     against `3146968066461787` — an adjacent pair, `80` read as `98`.
 *
 * So misreads of two digits happen on a passing read. The number that matters
 * is the distance to the thing being excluded, and that is not a misread: a
 * model that never saw the card either says so or confabulates, and a
 * confabulated sixteen-digit number misses in fourteen or fifteen places. Three
 * is comfortably above the observed misread rate and ~10^-11 by chance, so it
 * buys headroom against a flaky control without weakening what it excludes.
 */
export const PROBE_TOKEN_MAX_MISMATCHES = 3;

function findTokenWindow(haystack, token, maxMismatches) {
  const digits = haystack.replace(/[^0-9]/g, '');
  const n = token.length;
  let best = { index: -1, mismatches: n, window: '' };
  for (let i = 0; i + n <= digits.length; i += 1) {
    let mismatches = 0;
    for (let j = 0; j < n; j += 1) {
      if (digits[i + j] !== token[j]) mismatches += 1;
      if (mismatches >= best.mismatches) break;
    }
    if (mismatches < best.mismatches) {
      best = { index: i, mismatches, window: digits.slice(i, i + n) };
      if (mismatches === 0) break;
    }
  }
  return { ...best, ok: best.mismatches <= maxMismatches };
}

/**
 * Preflight 1. `turnText` must be everything the turn produced (tool results
 * included, since one placeholder mechanism writes into the tool result), and
 * `replyText` the assistant's own words.
 */
export function checkModelAcceptsImages({ turnText, replyText, token }) {
  const failures = [];
  const notes = [];

  const hits = IMAGE_PLACEHOLDERS.filter((p) => turnText.includes(p));
  if (hits.length > 0) {
    failures.push(
      `image placeholder present in the turn — no image reached the model: ${hits
        .map((h) => JSON.stringify(h))
        .join(', ')}`
    );
  }

  const match = findTokenWindow(replyText, token, PROBE_TOKEN_MAX_MISMATCHES);
  if (match.ok) {
    notes.push(
      `token read back as ${JSON.stringify(match.window)} against ${JSON.stringify(
        token
      )} (${match.mismatches} mismatched digit${match.mismatches === 1 ? '' : 's'})`
    );
  } else {
    failures.push(
      `probe token ${JSON.stringify(token)} not read back from the card; ` +
        `closest 16-digit run in the reply was ${JSON.stringify(
          match.window || '(none)'
        )} with ${match.mismatches} mismatches (limit ${PROBE_TOKEN_MAX_MISMATCHES})`
    );
  }

  return { ok: failures.length === 0, failures, notes };
}

/**
 * Preflight 2. `session` is one row of `sessions.usage`'s `sessions[]` with
 * `includeContextWeight: true`; its `contextWeight` IS the
 * `SessionSystemPromptReport`.
 *
 * `notBefore` guards the stale-report hole: `contextWeight` persists in the
 * session store across container recreates, so a report from a PREVIOUS
 * container would otherwise satisfy a naive membership check forever. Only a
 * report generated by a run in the container under test counts, which is also
 * why `source` must be "run" and not "estimate".
 */
export function checkSystemPromptListsSkills({
  session,
  requiredSkills,
  notBefore,
}) {
  const failures = [];
  const notes = [];

  const report = session?.contextWeight;
  if (!report) {
    return {
      ok: false,
      failures: [
        `no systemPromptReport for session ${JSON.stringify(
          session?.key ?? '(none)'
        )} — sessions.usage returned no contextWeight, so nothing is known about what the model was shown`,
      ],
      notes,
    };
  }

  if (report.source !== 'run') {
    failures.push(
      `systemPromptReport.source is ${JSON.stringify(
        report.source
      )}, not "run" — an estimate is not evidence of what a run was actually given`
    );
  }

  if (typeof notBefore === 'number' && !(report.generatedAt >= notBefore)) {
    failures.push(
      `systemPromptReport.generatedAt is ${new Date(
        report.generatedAt
      ).toISOString()}, before this preflight started (${new Date(
        notBefore
      ).toISOString()}) — this is a stale report from an earlier container`
    );
  }

  const entries = report.skills?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    failures.push(
      'systemPromptReport.skills.entries is empty — the model was shown no skills at all'
    );
  } else {
    const names = entries.map((e) => e.name);
    const missing = requiredSkills.filter((s) => !names.includes(s));
    if (missing.length > 0) {
      failures.push(
        `systemPromptReport.skills.entries does not list ${missing
          .map((m) => JSON.stringify(m))
          .join(', ')} — present: ${JSON.stringify(names)}`
      );
    } else {
      notes.push(
        `systemPromptReport.skills.entries lists ${requiredSkills
          .map((s) => JSON.stringify(s))
          .join(', ')} among ${names.length}: ${JSON.stringify(names)}`
      );
    }
  }

  return { ok: failures.length === 0, failures, notes };
}
