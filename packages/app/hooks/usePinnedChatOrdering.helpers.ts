/**
 * Pure helpers for `usePinnedChatOrdering`. Kept free of React and
 * `@tloncorp/shared` imports so they can be unit-tested directly. All ids are
 * `pin.itemId` (the canonical pinned-order/persistence identity), never
 * `chat.id` (TLON-5948).
 */

/**
 * Move `activeId` to the slot currently occupied by `overId`, preserving the
 * relative order of the rest (arrayMove semantics). Returns the reordered list.
 * A no-op (same slot, or ids not present) returns the input unchanged.
 */
export function reorderVisible(
  visibleIds: string[],
  activeId: string,
  overId: string
): string[] {
  const from = visibleIds.indexOf(activeId);
  const to = visibleIds.indexOf(overId);
  if (from === -1 || to === -1 || from === to) {
    return visibleIds;
  }
  const next = visibleIds.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * Reorder only the *visible* (addressed) ids within the full pinned order,
 * leaving hidden ids fixed in their current slots. `newVisibleOrder` is the
 * visible ids in their desired order. This mirrors the backend `%set-order`
 * slot-preserving semantics, so a reorder in a filtered tab (e.g. Messages)
 * never moves a pin the user can't see.
 */
export function mergeVisibleOrderIntoFull(
  fullOrder: string[],
  visibleIds: string[],
  newVisibleOrder: string[]
): string[] {
  const visibleSet = new Set(visibleIds);
  let v = 0;
  return fullOrder.map((id) =>
    visibleSet.has(id) ? (newVisibleOrder[v++] ?? id) : id
  );
}
