/** Native metadata describes identity and membership; native views supply geometry. */
export type NativeReadPhase = 'inactive' | 'target' | 'follow' | 'read';
export type NativeReadRowIdentity = { key: string; revision: string };
export type NativeReadMembership = {
  keys: readonly string[];
  rows: readonly NativeReadRowIdentity[];
  generation: string;
  nextId: number;
  valid: boolean;
};

export const emptyReadMembership: NativeReadMembership = {
  keys: [],
  rows: [],
  generation: '0',
  nextId: 1,
  valid: true,
};

/** Exact decimal increment without numeric precision loss or hash collisions. */
function nextMembershipGeneration(generation: string): string {
  const digits = generation.split('');
  for (let index = digits.length - 1; index >= 0; index--) {
    if (digits[index] !== '9') {
      digits[index] = String(Number(digits[index]) + 1);
      return digits.join('');
    }
    digits[index] = '0';
  }
  return `1${digits.join('')}`;
}

/** Row revisions are membership incarnations, independent of live post edits. */
export function reconcileReadMembership(
  previous: NativeReadMembership,
  keys: readonly string[]
): NativeReadMembership {
  if (
    keys.length === previous.keys.length &&
    keys.every((key, index) => key === previous.keys[index])
  )
    return previous;

  const generation = nextMembershipGeneration(previous.generation);
  const valid = keys.every(Boolean) && new Set(keys).size === keys.length;
  if (!valid)
    return {
      keys: [...keys],
      rows: [],
      generation,
      nextId: previous.nextId,
      valid,
    };
  const existing = new Map(previous.rows.map((row) => [row.key, row]));
  let nextId = previous.nextId;
  return {
    keys: [...keys],
    generation,
    rows: keys.map(
      (key) => existing.get(key) ?? { key, revision: String(nextId++) }
    ),
    nextId,
    valid,
  };
}

type ContentBlock = { type: string };
export type NativeReadBlockIdentity = {
  id: string;
  type: string;
  revision: string;
};
export type NativeReadBlockLineage = {
  blocks: readonly NativeReadBlockIdentity[];
  unresolvedBlockIds: readonly string[];
  nextId: number;
};
export const emptyReadBlockLineage: NativeReadBlockLineage = {
  blocks: [],
  unresolvedBlockIds: [],
  nextId: 1,
};

/**
 * Converted content has no durable block IDs. Preserve unique unchanged blocks,
 * and a single edited block between unambiguous neighbors. Ambiguous changes
 * explicitly keep old witnesses unavailable; absence cannot invent a deletion.
 * This is pure so an abandoned React render cannot consume committed identity.
 */
export function reconcileReadBlocks<T extends ContentBlock>(
  previous: NativeReadBlockLineage,
  content: readonly T[]
): NativeReadBlockLineage {
  const revisions = content.map((block) => JSON.stringify(block));
  if (
    revisions.length === previous.blocks.length &&
    revisions.every(
      (revision, index) => revision === previous.blocks[index].revision
    )
  )
    return previous;

  const occurrences = (values: readonly string[]) => {
    const result = new Map<string, number[]>();
    values.forEach((value, index) => {
      const indexes = result.get(value) ?? [];
      indexes.push(index);
      result.set(value, indexes);
    });
    return result;
  };
  const oldOccurrences = occurrences(
    previous.blocks.map((block) => block.revision)
  );
  const newOccurrences = occurrences(revisions);
  const matches = new Map<number, number>();
  const usedOld = new Set<number>();
  revisions.forEach((revision, index) => {
    const old = oldOccurrences.get(revision);
    if (old?.length === 1 && newOccurrences.get(revision)?.length === 1) {
      matches.set(index, old[0]);
      usedOld.add(old[0]);
    }
  });

  const removed = new Set<number>();
  const anchors = [
    [-1, -1],
    ...[...matches].sort(([left], [right]) => left - right),
    [content.length, previous.blocks.length],
  ];
  for (let index = 1; index < anchors.length; index++) {
    const [newStart, oldStart] = anchors[index - 1];
    const [newEnd, oldEnd] = anchors[index];
    if (oldEnd <= oldStart) continue;
    const oldGap = Array.from(
      { length: oldEnd - oldStart - 1 },
      (_, offset) => oldStart + offset + 1
    );
    if (oldGap.some((old) => usedOld.has(old))) continue;
    const newCount = newEnd - newStart - 1;
    if (newCount === 0) {
      oldGap.forEach((old) => removed.add(old));
    } else if (
      newCount === 1 &&
      oldGap.length === 1 &&
      content[newStart + 1].type === previous.blocks[oldGap[0]].type
    ) {
      matches.set(newStart + 1, oldGap[0]);
      usedOld.add(oldGap[0]);
    }
  }

  const unresolved = new Set(previous.unresolvedBlockIds);
  previous.blocks.forEach((block, index) => {
    if (!usedOld.has(index) && !removed.has(index)) unresolved.add(block.id);
  });
  let nextId = previous.nextId;
  const blocks = content.map((block, index) => {
    const oldIndex = matches.get(index);
    return {
      id:
        oldIndex === undefined
          ? `block-${nextId++}`
          : previous.blocks[oldIndex].id,
      type: block.type,
      revision: revisions[index],
    };
  });
  return { blocks, unresolvedBlockIds: [...unresolved], nextId };
}

export type NativeReadBinding = {
  version: 1;
  scope: string;
  visit: string;
};
export type NativeReadScopeDescriptor = NativeReadBinding & {
  intent: string;
  phase: NativeReadPhase;
  dataRevision: string;
  rows: readonly NativeReadRowIdentity[];
  /** Optional elapsed-time diagnostics; never part of reading identity. */
  diagnosticTimingSession?: string;
};

export function isNativeReadTimingSession(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    !/[^A-Za-z0-9._:-]/.test(value)
  );
}

/** Invalid membership is unavailable, never an authoritative empty row list. */
export function readScopeDescriptor(
  binding: NativeReadBinding,
  intent: string,
  phase: NativeReadPhase,
  membership: NativeReadMembership,
  diagnosticTimingSession?: string
): NativeReadScopeDescriptor | null {
  return membership.valid
    ? {
        ...binding,
        intent,
        phase,
        dataRevision: membership.generation,
        rows: membership.rows,
        ...(isNativeReadTimingSession(diagnosticTimingSession)
          ? { diagnosticTimingSession }
          : {}),
      }
    : null;
}
