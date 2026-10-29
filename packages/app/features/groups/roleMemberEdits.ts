// The holders the user added to or removed from a role, kept apart from the
// holders themselves so they apply over however many have loaded
export type MemberEdits = { added: string[]; removed: string[] };

export const NO_MEMBER_EDITS: MemberEdits = { added: [], removed: [] };

export function applyMemberEdits(holders: string[], edits: MemberEdits) {
  const removed = new Set(edits.removed);
  const kept = holders.filter((id) => !removed.has(id));
  const keptIds = new Set(kept);
  return [...kept, ...edits.added.filter((id) => !keptIds.has(id))];
}

// folds in a selection the user made starting from `baseline`
export function editMembers(
  edits: MemberEdits,
  baseline: string[],
  selection: string[]
): MemberEdits {
  const before = new Set(baseline);
  const after = new Set(selection);
  const added = new Set(edits.added);
  const removed = new Set(edits.removed);
  for (const id of after) {
    if (!before.has(id)) {
      added.add(id);
      removed.delete(id);
    }
  }
  for (const id of before) {
    if (!after.has(id)) {
      removed.add(id);
      added.delete(id);
    }
  }
  return { added: [...added], removed: [...removed] };
}
