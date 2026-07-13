import type { Pin } from '../db';

// Old groups-ui desks reject `%set-order` while converting the JSON poke to a
// Hoon noun. Airlock forwards that Gall nack as a raw string. Match the stable
// conversion frames narrowly so transport errors and unrelated agent crashes
// still take the normal reconcile/rollback path.
export function isUnsupportedPinnedItemOrderError(error: unknown): boolean {
  return (
    typeof error === 'string' &&
    error.includes(
      'gall: poke-as cast fail :groups-ui [a=%json b=%ui-action]'
    ) &&
    error.includes("[%bad-key 'set-order']") &&
    error.includes("[%key 'pins']")
  );
}

// Reorder only the pins named by `desired` into the slots they currently
// occupy. Pins omitted from `desired` keep their slots, which lets a filtered
// reorder coexist with pins the user could not see and with newly synced pins.
export function normalizePinnedItemOrder(
  desired: string[],
  current: Pin[]
): string[] {
  const order = [...current]
    .sort((a, b) => a.index - b.index)
    .map((pin) => pin.itemId);
  const pinnedSet = new Set(order);
  const wanted = [...new Set(desired)].filter((id) => pinnedSet.has(id));
  const wantedSet = new Set(wanted);
  let wantedIndex = 0;

  return order.map((id) => (wantedSet.has(id) ? wanted[wantedIndex++] : id));
}

export function applyPinnedItemOrder(desired: string[], current: Pin[]): Pin[] {
  const pinsById = new Map(current.map((pin) => [pin.itemId, pin]));

  return normalizePinnedItemOrder(desired, current).map((itemId, index) => ({
    ...pinsById.get(itemId)!,
    index,
  }));
}
