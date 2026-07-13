import { poke, scry } from '@tloncorp/api';
import { afterEach, expect, test, vi } from 'vitest';

import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';
import { reorderPinnedItems } from './channelActions';
import { isUnsupportedPinnedItemOrderError } from './pinnedItemOrder';

setupDatabaseTestSuite();

afterEach(() => {
  vi.mocked(poke).mockReset();
  vi.mocked(scry).mockReset();
});

async function seedPins(ids: string[]) {
  await db.insertPinnedItems(
    ids.map((itemId, index) => ({ type: 'group' as const, index, itemId }))
  );
}

async function currentOrder() {
  const pins = await db.getPinnedItems();
  return [...pins].sort((a, b) => a.index - b.index).map((p) => p.itemId);
}

// The `set-order` id list of the most recent backend poke (api.setPinnedItemOrder
// pokes `{ pins: { 'set-order': itemIds } }`).
function lastPokeSetOrder(): string[] {
  const calls = vi.mocked(poke).mock.calls;
  const last = calls[calls.length - 1]?.[0] as {
    json: { pins: { 'set-order': string[] } };
  };
  return last.json.pins['set-order'];
}

const unsupportedSetOrderNack =
  "gall: poke-as cast fail :groups-ui [a=%json b=%ui-action]\n[%bad-key 'set-order']\n[%key 'pins']\n/sys/vane/gall/hoon:<[1.047 27].[1.047 45]>\n";

test('identifies only the old-desk set-order conversion failure', () => {
  expect(isUnsupportedPinnedItemOrderError(unsupportedSetOrderNack)).toBe(true);
  expect(
    isUnsupportedPinnedItemOrderError(
      "gall: poke-as cast fail :groups-ui [a=%json b=%ui-action]\n[%bad-key 'other-action']\n[%key 'pins']"
    )
  ).toBe(false);
  expect(isUnsupportedPinnedItemOrderError(new Error('network down'))).toBe(
    false
  );
});

test('reorderPinnedItems writes the full optimistic order locally but pokes only the reordered visible ids', async () => {
  await seedPins(['C', 'A', 'B']);

  // Filtered view: C is hidden; the visible subset [A, B] is reordered to [B, A],
  // which the caller has already merged into the full order [C, B, A].
  const ok = await reorderPinnedItems({
    optimisticOrder: ['C', 'B', 'A'],
    backendOrder: ['B', 'A'],
  });

  expect(ok).toBe(true);
  // Local DB reflects the full merged order (C held in slot 0).
  expect(await currentOrder()).toEqual(['C', 'B', 'A']);
  // The backend poke carries ONLY the visible ids — never the full order — so
  // %set-order leaves the omitted (hidden) pins in their current server slots.
  expect(lastPokeSetOrder()).toEqual(['B', 'A']);
});

test('reorderPinnedItems omits hidden pins from the backend payload (stale-hidden-pin safety)', async () => {
  // H is a hidden pin (not in the visible subset). Visible A/B reordered to B/A.
  await seedPins(['H', 'A', 'B']);

  const ok = await reorderPinnedItems({
    optimisticOrder: ['H', 'B', 'A'],
    backendOrder: ['B', 'A'],
  });

  expect(ok).toBe(true);
  expect(await currentOrder()).toEqual(['H', 'B', 'A']);
  // H must NOT appear in the poke — otherwise the backend would re-slot H from
  // this client's (possibly stale) snapshot, clobbering a peer's hidden-pin move.
  expect(lastPokeSetOrder()).toEqual(['B', 'A']);
  expect(lastPokeSetOrder()).not.toContain('H');
});

test('reorderPinnedItems reasserts only the visible ids when a sync lands mid-poke', async () => {
  // Filtered view starting from a stale full order; H is hidden.
  await seedPins(['H', 'A', 'B']);

  // The successful poke stands in for the in-flight window: a boot/auth pin sync
  // lands and moves hidden H, writing the authoritative order [A, H, B] locally
  // before the poke resolves.
  vi.mocked(poke).mockImplementationOnce(async () => {
    await db.insertPinnedItems([
      { type: 'group' as const, index: 0, itemId: 'A' },
      { type: 'group' as const, index: 1, itemId: 'H' },
      { type: 'group' as const, index: 2, itemId: 'B' },
    ]);
    return 0; // poke request id (unused by reorderPinnedItems)
  });

  const ok = await reorderPinnedItems({
    optimisticOrder: ['H', 'B', 'A'],
    backendOrder: ['B', 'A'],
  });

  expect(ok).toBe(true);
  // The success reassert applies ONLY the visible ids ([B, A]) against the synced
  // order, so H keeps the slot the sync gave it (1) and the visible pins reorder
  // around it. Re-asserting the full optimistic order would have written [H,B,A],
  // dragging H back to slot 0.
  expect(await currentOrder()).toEqual(['B', 'H', 'A']);
  expect(lastPokeSetOrder()).toEqual(['B', 'A']);
});

test('reorderPinnedItems keeps the local order for the old-desk conversion failure', async () => {
  await seedPins(['H', 'A', 'B']);
  let orderSeenBeforePoke: string[] = [];
  let pendingOrderSeenBeforePoke: string[] = [];
  let storedOrder: string[] | null = null;
  const getPendingOrder = vi
    .spyOn(db.pendingPinnedItemsOrder, 'getValue')
    .mockImplementation(async () => storedOrder);
  const setPendingOrder = vi
    .spyOn(db.pendingPinnedItemsOrder, 'setValue')
    .mockImplementation(async (value) => {
      storedOrder = typeof value === 'function' ? value(storedOrder) : value;
    });

  vi.mocked(poke).mockImplementationOnce(async () => {
    orderSeenBeforePoke = await currentOrder();
    pendingOrderSeenBeforePoke = storedOrder ?? [];
    // Simulate a stale pin sync landing while the unsupported poke is in flight.
    await db.insertPinnedItems([
      { type: 'group' as const, index: 0, itemId: 'A' },
      { type: 'group' as const, index: 1, itemId: 'H' },
      { type: 'group' as const, index: 2, itemId: 'B' },
    ]);
    throw unsupportedSetOrderNack;
  });

  const ok = await reorderPinnedItems({
    optimisticOrder: ['H', 'B', 'A'],
    backendOrder: ['B', 'A'],
    keepLocalOrderOnUnsupportedBackend: true,
  });

  // The full order is durably written before the best-effort server poke.
  expect(orderSeenBeforePoke).toEqual(['H', 'B', 'A']);
  expect(pendingOrderSeenBeforePoke).toEqual(['H', 'B', 'A']);
  // A rejected poke is swallowed, and the visible reorder is re-asserted over
  // the concurrent sync without moving its hidden pin.
  expect(ok).toBe(true);
  expect(await currentOrder()).toEqual(['B', 'H', 'A']);
  expect(lastPokeSetOrder()).toEqual(['B', 'A']);
  expect(scry).not.toHaveBeenCalled();
  expect(setPendingOrder).toHaveBeenNthCalledWith(1, ['H', 'B', 'A']);
  expect(setPendingOrder).toHaveBeenLastCalledWith(['B', 'H', 'A']);
  expect(storedOrder).toEqual(['B', 'H', 'A']);
  getPendingOrder.mockRestore();
  setPendingOrder.mockRestore();
});

test('reorderPinnedItems clears pending state and reconciles transient failures', async () => {
  await seedPins(['C', 'A', 'B']);
  let storedOrder: string[] | null = null;
  const setPendingOrder = vi
    .spyOn(db.pendingPinnedItemsOrder, 'setValue')
    .mockImplementation(async (value) => {
      storedOrder = typeof value === 'function' ? value(storedOrder) : value;
    });
  vi.mocked(poke).mockRejectedValueOnce(new Error('network down'));
  vi.mocked(scry).mockResolvedValueOnce(['A', 'B', 'C']);

  const ok = await reorderPinnedItems({
    optimisticOrder: ['C', 'B', 'A'],
    backendOrder: ['B', 'A'],
    keepLocalOrderOnUnsupportedBackend: true,
  });

  expect(ok).toBe(false);
  expect(await currentOrder()).toEqual(['A', 'B', 'C']);
  expect(setPendingOrder).toHaveBeenNthCalledWith(1, ['C', 'B', 'A']);
  expect(setPendingOrder).toHaveBeenLastCalledWith(null);
  expect(storedOrder).toBeNull();
  setPendingOrder.mockRestore();
});

test('reorderPinnedItems is a no-op when the order is unchanged', async () => {
  await seedPins(['A', 'B', 'C']);

  const ok = await reorderPinnedItems({
    optimisticOrder: ['A', 'B', 'C'],
    backendOrder: ['A', 'B', 'C'],
  });

  expect(ok).toBe(true);
  expect(await currentOrder()).toEqual(['A', 'B', 'C']);
  expect(poke).not.toHaveBeenCalled();
});

test('reorderPinnedItems reconciles from the backend (not the snapshot) on poke failure', async () => {
  await seedPins(['C', 'A', 'B']);
  vi.mocked(poke).mockRejectedValueOnce(new Error('network down'));
  // Backend authoritative order differs from both the snapshot and the drop.
  vi.mocked(scry).mockResolvedValueOnce(['A', 'B', 'C']);

  const ok = await reorderPinnedItems({
    optimisticOrder: ['C', 'B', 'A'],
    backendOrder: ['B', 'A'],
  });

  expect(ok).toBe(false);
  // Local reflects the re-scried backend order, proving it reconciled from the
  // backend rather than restoring the pre-op snapshot or keeping the optimistic write.
  expect(await currentOrder()).toEqual(['A', 'B', 'C']);
});

test('reorderPinnedItems clears local pins when the failure reconcile returns an empty snapshot', async () => {
  await seedPins(['C', 'A', 'B']);
  vi.mocked(poke).mockRejectedValueOnce(new Error('network down'));
  // Authoritative backend snapshot is empty: local pins must be cleared, not left
  // stale (insertPinnedItems([]) is a no-op, so the path uses clearPinnedItems).
  vi.mocked(scry).mockResolvedValueOnce([]);

  const ok = await reorderPinnedItems({
    optimisticOrder: ['C', 'B', 'A'],
    backendOrder: ['B', 'A'],
  });

  expect(ok).toBe(false);
  expect(await db.getPinnedItems()).toHaveLength(0);
});

test('reorderPinnedItems never throws and rolls back locally when both poke and reconcile fail', async () => {
  await seedPins(['C', 'A', 'B']);
  vi.mocked(poke).mockRejectedValueOnce(new Error('network down'));
  vi.mocked(scry).mockRejectedValueOnce(new Error('network down'));

  // Must resolve (not reject) so drag handlers keep the boolean contract.
  const ok = await reorderPinnedItems({
    optimisticOrder: ['C', 'B', 'A'],
    backendOrder: ['B', 'A'],
  });

  expect(ok).toBe(false);
  // Reconcile failed, nothing else touched local pins, so the optimistic write
  // is rolled back to the original order.
  expect(await currentOrder()).toEqual(['C', 'A', 'B']);
});
