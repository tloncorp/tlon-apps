/**
 * Both preflight assertions, exercised against the conditions they exist to
 * catch. Run with:  node --test packages/openclaw/dev/
 *
 * The bad arms are not invented. `preflight-fixtures/d112-skill-delivery-arms.json`
 * holds two REAL `sessions.usage --includeContextWeight` rows lifted out of the
 * 6a container's session store: `arma` was collected while the dev container's
 * skill delivery was broken by the pre-97e2abee9c symlink shape, and `armb` was
 * collected minutes later from the same container after the fix. They differ by
 * exactly the two skills the bug dropped, so the assertion is checked against
 * the failure it was written for rather than a mock of it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  IMAGE_PLACEHOLDERS,
  checkModelAcceptsImages,
  checkSystemPromptListsSkills,
} from './preflight-assertions.mjs';

const DEV_DIR = dirname(fileURLToPath(import.meta.url));
const ARMS = JSON.parse(
  readFileSync(
    join(DEV_DIR, 'preflight-fixtures', 'd112-skill-delivery-arms.json'),
    'utf8'
  )
);
const BROKEN = ARMS['agent:dev:arma-1788220150'];
const FIXED = ARMS['agent:dev:armb-1788220215'];
const REQUIRED = ['surfaces', 'tlon'];
/** Both fixture rows predate any run of this test, so freshness is waived here. */
const NO_FRESHNESS = undefined;

test('D112: fails on the container whose skill delivery was broken', () => {
  const r = checkSystemPromptListsSkills({
    session: BROKEN,
    requiredSkills: REQUIRED,
    notBefore: NO_FRESHNESS,
  });
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /does not list "surfaces", "tlon"/);
  // The discriminating part: the broken arm still reported ELEVEN other skills
  // and every file was present on disk. Existence proves nothing here.
  assert.equal(BROKEN.contextWeight.skills.entries.length, 13);
});

test('D112: passes on the same container after the fix', () => {
  const r = checkSystemPromptListsSkills({
    session: FIXED,
    requiredSkills: REQUIRED,
    notBefore: NO_FRESHNESS,
  });
  assert.equal(r.ok, true, r.failures.join('\n'));
  assert.equal(FIXED.contextWeight.skills.entries.length, 15);
});

test('D112: a stale report from an earlier container does not pass', () => {
  const r = checkSystemPromptListsSkills({
    session: FIXED,
    requiredSkills: REQUIRED,
    notBefore: FIXED.contextWeight.generatedAt + 1,
  });
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /stale report from an earlier container/);
});

test('D112: an estimate is not evidence of what a run was given', () => {
  const r = checkSystemPromptListsSkills({
    session: {
      ...FIXED,
      contextWeight: { ...FIXED.contextWeight, source: 'estimate' },
    },
    requiredSkills: REQUIRED,
    notBefore: NO_FRESHNESS,
  });
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /source is "estimate"/);
});

test('D112: no report at all is a failure, not a skip', () => {
  const r = checkSystemPromptListsSkills({
    session: { key: 'agent:dev:tlon:direct:~ten' },
    requiredSkills: REQUIRED,
    notBefore: NO_FRESHNESS,
  });
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /no systemPromptReport/);
});

const TOKEN = '5186831846659979';

test('D111: passes when the model reads the card back', () => {
  const replyText = `${TOKEN} 7`;
  const r = checkModelAcceptsImages({
    turnText: JSON.stringify({ replyText }),
    replyText,
    token: TOKEN,
  });
  assert.equal(r.ok, true, r.failures.join('\n'));
});

test('D111: tolerates the one-character misread D111 actually observed', () => {
  const replyText = `I see 5186831846659978 and 7 squares.`;
  const r = checkModelAcceptsImages({
    turnText: JSON.stringify({ replyText }),
    replyText,
    token: TOKEN,
  });
  assert.equal(r.ok, true, r.failures.join('\n'));
});

test('D111: fails on a text-only model — every placeholder core can emit', () => {
  for (const placeholder of IMAGE_PLACEHOLDERS) {
    const replyText = `I can't see the image; the read tool returned ${placeholder}`;
    const r = checkModelAcceptsImages({
      turnText: JSON.stringify({ replyText }),
      replyText,
      token: TOKEN,
    });
    assert.equal(r.ok, false, `placeholder passed: ${placeholder}`);
    assert.match(r.failures.join('\n'), /no image reached the model/);
    // and the token is missing too, which is the independent half
    assert.match(r.failures.join('\n'), /not read back from the card/);
  }
});

test('D111: a placeholder buried in a tool result still fails', () => {
  // The reply can be perfectly cheerful while the tool result carries the
  // placeholder; the turn is scanned, not just the words the model chose.
  const replyText = 'Done!';
  const turnText = JSON.stringify({
    toolResult: '[tool image omitted: model does not support images]',
    replyText,
  });
  const r = checkModelAcceptsImages({ turnText, replyText, token: TOKEN });
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /no image reached the model/);
});

test('D111: tolerates the two-digit misread observed on 2026-09-01', () => {
  // card 3146968066461787 -> reply 3146969866461787, "80" read as "98"
  const r = checkModelAcceptsImages({
    turnText: JSON.stringify({ replyText: '3146969866461787\n7' }),
    replyText: '3146969866461787\n7',
    token: '3146968066461787',
  });
  assert.equal(r.ok, true, r.failures.join('\n'));
});

test('D111: a plausible-looking but wrong number does not pass', () => {
  const replyText = 'The number is 1234567890123456 and there are 7 squares.';
  const r = checkModelAcceptsImages({
    turnText: JSON.stringify({ replyText }),
    replyText,
    token: TOKEN,
  });
  assert.equal(r.ok, false);
});

/**
 * The pair that matters: two REAL probe turns from the 6a container, differing
 * in the one variable this control exists to detect.
 *
 * `d111-text-only-model-turn.json` is D111's own negative control — the same
 * probe shape, run with MODEL pointed at a catalogued text-only model. Note
 * what the stored turn shows: the tool result still carries an `image` block,
 * because the substitution happens in the provider transform, downstream of
 * anything written to the session. The placeholder is visible only because the
 * model quoted it back. That is why the token half of this assertion is the
 * load-bearing one and the placeholder scan is corroboration — a text-only
 * model that did NOT narrate its own blindness would slip past a placeholder
 * scan alone, and is still caught by the missing token.
 */
const NEG = JSON.parse(
  readFileSync(
    join(DEV_DIR, 'preflight-fixtures', 'd111-text-only-model-turn.json'),
    'utf8'
  )
);
const POS = JSON.parse(
  readFileSync(
    join(DEV_DIR, 'preflight-fixtures', 'd111-vision-model-turn.json'),
    'utf8'
  )
);

test("D111: fails on the recorded text-only-model turn (D111's own arm)", () => {
  const r = checkModelAcceptsImages({
    turnText: JSON.stringify(NEG.turn),
    replyText: NEG.replyText,
    // That probe's card carried a hex token; the shipped probe uses digits.
    // Either way the assertion is "these digits came back", and from a model
    // that cannot see the card, they cannot.
    token: POS.token,
  });
  assert.equal(r.ok, false);
  assert.match(
    r.failures.join('\n'),
    /\(tool image omitted: model does not support images\)/
  );
  assert.match(r.failures.join('\n'), /not read back from the card/);
});

test('D111: passes on the recorded vision-model turn, same probe shape', () => {
  const r = checkModelAcceptsImages({
    turnText: JSON.stringify(POS.turn),
    replyText: POS.replyText,
    token: POS.token,
  });
  assert.equal(r.ok, true, r.failures.join('\n'));
});
