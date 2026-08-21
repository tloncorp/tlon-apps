import { REF_REGEX } from '@tloncorp/shared/logic';
import { describe, expect, test } from 'vitest';

import { computeTextChangeAction } from './helpers';

const REF_PATH = '/1/chan/chat/~zod/test/msg/170.141.184.506';
const REF_TEXT = `check this out ${REF_PATH}`;

describe('computeTextChangeAction', () => {
  test('unprocessed ref-bearing text asks for reference processing', () => {
    expect(computeTextChangeAction(REF_TEXT, '')).toBe('processReferences');
  });

  // The reported bug (TLON-6365): the old two-`.test()` version left the
  // g-flagged REF_REGEX's lastIndex past the match, so re-evaluating the same
  // text missed the ref and the event was misrouted.
  test('evaluation is stateless: identical inputs always yield the same action', () => {
    expect(computeTextChangeAction(REF_TEXT, '')).toBe('processReferences');
    expect(computeTextChangeAction(REF_TEXT, '')).toBe('processReferences');
  });

  test('already-processed ref-bearing text does nothing', () => {
    expect(computeTextChangeAction(REF_TEXT, REF_TEXT)).toBe('none');
  });

  test('a poisoned REF_REGEX lastIndex cannot influence the decision', () => {
    REF_REGEX.lastIndex = REF_TEXT.indexOf(REF_PATH) + 5;
    expect(computeTextChangeAction(REF_TEXT, '')).toBe('processReferences');
  });

  test('ref-free text updates normally', () => {
    expect(computeTextChangeAction('just a message', '')).toBe('update');
    expect(computeTextChangeAction('', '')).toBe('update');
  });

  test('refs are detected at the start and in the middle of the text', () => {
    expect(computeTextChangeAction(REF_PATH, '')).toBe('processReferences');
    expect(computeTextChangeAction(`${REF_PATH} nice`, '')).toBe(
      'processReferences'
    );
    expect(computeTextChangeAction(`look ${REF_PATH} nice`, '')).toBe(
      'processReferences'
    );
  });
});
