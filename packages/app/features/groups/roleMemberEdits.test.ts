import { describe, expect, test } from 'vitest';

import {
  NO_MEMBER_EDITS,
  applyMemberEdits,
  editMembers,
} from './roleMemberEdits';

// the form's save: adds and removals relative to the holders loaded now
function changes(holders: string[], selection: string[]) {
  return {
    add: selection.filter((id) => !holders.includes(id)),
    remove: holders.filter((id) => !selection.includes(id)),
  };
}

describe('role member edits', () => {
  test('holders that load after the form opens keep the role', () => {
    const edits = editMembers(NO_MEMBER_EDITS, ['~zod'], ['~zod', '~bud']);
    const holders = ['~zod', '~nec', '~wes'];

    expect(changes(holders, applyMemberEdits(holders, edits))).toEqual({
      add: ['~bud'],
      remove: [],
    });
  });

  test('a removal still applies once more holders load', () => {
    const edits = editMembers(NO_MEMBER_EDITS, ['~zod', '~nec'], ['~zod']);
    const holders = ['~zod', '~nec', '~wes'];

    expect(changes(holders, applyMemberEdits(holders, edits))).toEqual({
      add: [],
      remove: ['~nec'],
    });
  });

  test('a later pick undoes an earlier one', () => {
    const holders = ['~zod', '~nec'];
    const removed = editMembers(NO_MEMBER_EDITS, holders, ['~zod']);
    const restored = editMembers(removed, ['~zod'], holders);

    expect(changes(holders, applyMemberEdits(holders, restored))).toEqual({
      add: [],
      remove: [],
    });
  });

  test('re-adding a member removed earlier adds them', () => {
    const added = editMembers(NO_MEMBER_EDITS, ['~zod'], ['~zod', '~bud']);
    const removed = editMembers(added, ['~zod', '~bud'], ['~zod']);
    const readded = editMembers(removed, ['~zod'], ['~zod', '~bud']);

    expect(changes(['~zod'], applyMemberEdits(['~zod'], readded))).toEqual({
      add: ['~bud'],
      remove: [],
    });
  });

  test('no edits leave the loaded holders as they are', () => {
    expect(applyMemberEdits(['~zod', '~nec'], NO_MEMBER_EDITS)).toEqual([
      '~zod',
      '~nec',
    ]);
  });
});
