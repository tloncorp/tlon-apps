/**
 * Pure helpers for `useSortableChannelNav`. Kept in a separate file (free
 * of any React or `@tloncorp/shared/db` imports) so they can be unit-tested
 * with vitest without dragging the hook's transitive runtime imports into
 * the test transform.
 */

/**
 * Returns the channel ids that appear in more than one section in the
 * given input. The frontend local DB permits the same `channelId` across
 * multiple `groupNavSectionId`s (the composite primary key is per-section),
 * but the product invariant is one nav section per channel. When duplicates
 * are present, the read-side dedupe must keep `Sortable.Grid` keys unique
 * to avoid the iOS activation gate, but the save path cannot treat the
 * deduped first-occurrence ordering as authoritative — the frontend has
 * no way to know which duplicate section the backend considers canonical.
 */
export function findDuplicateChannelIds(
  sections: ReadonlyArray<{ channels: ReadonlyArray<{ id: string }> }>
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const section of sections) {
    for (const channel of section.channels) {
      if (seen.has(channel.id)) {
        duplicates.add(channel.id);
      } else {
        seen.add(channel.id);
      }
    }
  }
  return Array.from(duplicates);
}

/**
 * Decision helper for the duplicate-membership repair trigger. Given the
 * current set of duplicate channel ids and the fingerprint we last fired
 * on, returns the next fingerprint and whether the repair callback should
 * fire now.
 *
 * The fingerprint is a normalized join of the duplicate id set so the
 * trigger fires once per distinct set of duplicates (and re-arms when
 * duplicates clear). This keeps a forced group sync from being kicked off
 * on every render while the local data remains corrupt, without losing
 * the ability to re-trigger when the duplicate set actually changes.
 */
export function shouldFireDuplicatesCallback(
  duplicateChannelIds: ReadonlyArray<string>,
  lastFingerprint: string | null
): { fingerprint: string | null; shouldFire: boolean } {
  if (duplicateChannelIds.length === 0) {
    return { fingerprint: null, shouldFire: false };
  }
  const fingerprint = [...duplicateChannelIds].sort().join('|');
  return {
    fingerprint,
    shouldFire: fingerprint !== lastFingerprint,
  };
}
