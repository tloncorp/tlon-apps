import { describe, expect, test } from 'vitest';

import { CONTAINS_REF_REGEX, REF_REGEX } from '../client/utils';

const REF_TEXT = 'check this out /1/chan/chat/~zod/test/msg/170.141.184.506';

describe('ref regexes', () => {
  test('CONTAINS_REF_REGEX is stateless across repeated tests', () => {
    expect(CONTAINS_REF_REGEX.global).toBe(false);
    expect(CONTAINS_REF_REGEX.test(REF_TEXT)).toBe(true);
    expect(CONTAINS_REF_REGEX.test(REF_TEXT)).toBe(true);
    expect(CONTAINS_REF_REGEX.test(REF_TEXT)).toBe(true);
  });

  // match-all (processReferences) and replace-all (filterRegexFromJson) callers
  // depend on the g flag.
  test('REF_REGEX keeps its global flag', () => {
    expect(REF_REGEX.global).toBe(true);
  });

  test('both regexes share one pattern', () => {
    expect(CONTAINS_REF_REGEX.source).toBe(REF_REGEX.source);
  });
});
