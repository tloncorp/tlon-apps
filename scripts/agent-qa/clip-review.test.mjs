import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyClipReview, clipReviewSchema } from './clip-review.mjs';

const presentation = { findings: [{ title: 'Appended text disappears' }] };
const moment = (frame, observation) => ({
  frame,
  observation,
  evidenceId: 'video-frames-1',
});
const selection = {
  'group-1': {
    clips: [
      {
        label: 'Text disappears after submitting',
        additionalCase: '',
        before: moment(20, 'The appended text is present'),
        trigger: moment(25, 'Submit tapped'),
        outcome: moment(55, 'The appended text is missing'),
        settled: moment(57, 'It remains missing'),
      },
    ],
    unavailableReason: '',
  },
};
const info = { timestamps: Array.from({ length: 100 }, (_, i) => i) };
const receipts = {
  'video-frames-1': {
    frames: [20, 25, 55, 57].map((index) => ({ index, seconds: index })),
  },
};
test('one complete clip retains a late disappearance instead of cutting early fragments', () => {
  const windows = verifyClipReview(
    selection,
    presentation,
    receipts,
    info,
    100
  );
  assert.equal(windows[0].length, 1);
  assert.equal(windows[0][0].start, 19);
  assert.equal(windows[0][0].end, 59);
  assert.ok(windows[0][0].end > 55);
  assert.deepEqual(clipReviewSchema(presentation).required, ['group-1']);
});
test('clips require observed ordered outcomes; repeated footage is rejected', () => {
  for (const mutate of [
    (v) => {
      v['group-1'].clips[0].outcome.frame = 54;
    },
    (v) => {
      v['group-1'].clips[0].outcome.frame = 20;
    },
    (v) => {
      v['group-1'].clips[0].settled.frame = 25;
    },
    (v) => {
      v['group-1'].clips.push(structuredClone(v['group-1'].clips[0]));
    },
    (v) => {
      v['group-1'].clips.push({
        ...structuredClone(v['group-1'].clips[0]),
        label: 'Another fragment',
        additionalCase: 'Same event',
      });
    },
  ]) {
    const v = structuredClone(selection);
    mutate(v);
    assert.throws(() => verifyClipReview(v, presentation, receipts, info, 100));
  }
});
test('missing complete evidence is explicit and does not attach a guessed clip', () => {
  const v = {
    'group-1': {
      clips: [],
      unavailableReason: 'The recording stops before submission.',
    },
  };
  assert.deepEqual(verifyClipReview(v, presentation, {}, info, 100), [[]]);
  assert.throws(() =>
    verifyClipReview(
      { 'group-1': { ...v['group-1'], unavailableReason: '' } },
      presentation,
      {},
      info,
      100
    )
  );
});
