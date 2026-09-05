import { describe, expect, it } from 'bun:test';

import { groupShareHintLines } from './share-hint';

describe('groupShareHintLines', () => {
  // The Hermes groups prompt instructs models to copy "the Ref: path from
  // the command output" verbatim; this output shape is that contract.
  it('emits the Ref line and the sharing hint', () => {
    expect(groupShareHintLines('~zod/abcdefgh')).toEqual([
      '   Ref: /1/group/~zod/abcdefgh',
      '   Share: include the Ref path in a chat message to post a tappable group card.',
    ]);
  });
});
