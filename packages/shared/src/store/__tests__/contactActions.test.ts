import * as api from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as db from '../../db';
import {
  ensureBotInfoSynced,
  resetBotInfoBackfillState,
} from '../contactActions';
import { updateSession } from '../session';
import { handleContactUpdate } from '../sync/sync';

// Only the transport-backed calls are faked; `v1PeerToClientProfile` stays
// real so the subscription carrier below exercises the actual mapper.
vi.mock('@tloncorp/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tloncorp/api')>();
  return {
    ...actual,
    getCurrentUserId: vi.fn(() => '~zod'),
    syncUserProfiles: vi.fn(async () => {}),
    getContactProfile: vi.fn(async () => null),
  };
});

vi.mock('../../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../db')>();
  return {
    ...actual,
    getContact: vi.fn(async () => null),
    upsertContact: vi.fn(async () => {}),
  };
});

const ship = '~bot';
const claim = JSON.stringify({
  v: 1,
  harness: 'openclaw',
  version: '0.19.0',
});

// The C-3 recovery carrier: a `/v1/news` %peer fact mapped by the real
// contacts mapper and written by the real sync handler.
async function deliverPeerFact(who: string, botInfo: string) {
  const contact = api.v1PeerToClientProfile(who, {
    'bot-info': { type: 'text', value: botInfo },
  } as never);
  await handleContactUpdate({ type: 'upsertContact', contact });
}

// The backfill only acts on a known non-contact row, so every fetching case
// starts from one.
function nonContactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ship,
    isContact: false,
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof db.getContact>>;
}

describe('ensureBotInfoSynced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBotInfoBackfillState();
    // Every missing-claim backfill is gated on the sync phase; start each case
    // from a settled sync and let the gate cases drive the phase themselves.
    updateSession({ phase: 'ready' });
    vi.mocked(db.getContact).mockResolvedValue(nonContactRow());
    vi.mocked(api.getContactProfile).mockResolvedValue(null);
  });

  afterEach(() => {
    updateSession(null);
  });

  it('meets the ship and upserts the fetched profile', async () => {
    vi.mocked(api.getContactProfile).mockResolvedValue({
      id: ship,
      botInfo: claim,
    } as db.Contact);

    await ensureBotInfoSynced(ship);

    expect(api.syncUserProfiles).toHaveBeenCalledWith([ship]);
    expect(api.getContactProfile).toHaveBeenCalledWith(ship);
    expect(db.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: ship, botInfo: claim })
    );
  });

  it('dedupes concurrent callers before the first await', async () => {
    // The race is at the *DB read*, which precedes the reservation in the
    // buggy shape: both callers pass the in-flight check while the first is
    // still awaiting getContact, so both reach the network.
    let releaseContact: () => void;
    const contactPending = new Promise<void>(
      (resolve) => (releaseContact = resolve)
    );
    vi.mocked(db.getContact).mockImplementation(async () => {
      await contactPending;
      return nonContactRow();
    });

    const both = Promise.all([
      ensureBotInfoSynced(ship),
      ensureBotInfoSynced(ship),
    ]);
    releaseContact!();
    await both;

    expect(api.syncUserProfiles).toHaveBeenCalledTimes(1);
    expect(api.getContactProfile).toHaveBeenCalledTimes(1);
  });

  it('retries after a scry miss (first scry races the %meet watch)', async () => {
    vi.mocked(api.getContactProfile).mockResolvedValueOnce(null);

    await ensureBotInfoSynced(ship);
    expect(db.upsertContact).not.toHaveBeenCalled();

    // The profile arrives on a later attempt (scry or subscription-fed).
    vi.mocked(api.getContactProfile).mockResolvedValueOnce({
      id: ship,
      botInfo: claim,
    } as db.Contact);
    await ensureBotInfoSynced(ship);
    expect(db.upsertContact).toHaveBeenCalledTimes(1);
  });

  it('scry misses, then the profile lands via the subscription path', async () => {
    // First attempt races the %meet watch: the scry 404s.
    vi.mocked(api.getContactProfile).mockResolvedValueOnce(null);
    await ensureBotInfoSynced(ship);
    expect(db.upsertContact).not.toHaveBeenCalled();

    // The %peer fact then arrives through the real contacts subscription and
    // is written by the real sync handler — no hand-rolled upsert here, so
    // breaking either carrier fails this test.
    await deliverPeerFact(ship, claim);
    expect(db.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: ship, botInfo: claim }),
      undefined
    );

    // A later hook evaluation sees the stored claim and stops fetching.
    vi.mocked(db.getContact).mockResolvedValueOnce(
      nonContactRow({ botInfo: claim })
    );
    await ensureBotInfoSynced(ship);
    expect(api.getContactProfile).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure; failures are not cached as done', async () => {
    vi.mocked(api.getContactProfile)
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({ id: ship, botInfo: claim } as db.Contact);

    await ensureBotInfoSynced(ship);
    expect(db.upsertContact).not.toHaveBeenCalled();

    await ensureBotInfoSynced(ship);
    expect(db.upsertContact).toHaveBeenCalledTimes(1);
  });

  it('bounds retries per ship for the process lifetime', async () => {
    vi.mocked(api.getContactProfile).mockResolvedValue(null);

    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);

    expect(api.getContactProfile).toHaveBeenCalledTimes(3);
  });

  it('charges the cap for fetches that reject, so failures stay bounded', async () => {
    // The attempt is counted when a permitted one *starts*, not when the
    // network completes: a bot whose fetch always rejects would otherwise be
    // retried on every hook evaluation forever.
    vi.mocked(api.getContactProfile).mockRejectedValue(new Error('offline'));

    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    expect(api.getContactProfile).toHaveBeenCalledTimes(3);

    // Cap + 1: the last evaluation must not reach the network at all.
    await ensureBotInfoSynced(ship);
    expect(api.syncUserProfiles).toHaveBeenCalledTimes(3);
    expect(api.getContactProfile).toHaveBeenCalledTimes(3);
  });

  it('skips contact-book rows (they arrive lossless via v1 /book)', async () => {
    vi.mocked(db.getContact).mockResolvedValue({
      id: ship,
      isContact: true,
    } as unknown as Awaited<ReturnType<typeof db.getContact>>);

    await ensureBotInfoSynced(ship);

    expect(api.syncUserProfiles).not.toHaveBeenCalled();
    expect(api.getContactProfile).not.toHaveBeenCalled();
  });

  it('skips ships that already published a usable claim', async () => {
    vi.mocked(db.getContact).mockResolvedValue(
      nonContactRow({ botInfo: claim })
    );

    await ensureBotInfoSynced(ship);

    expect(api.syncUserProfiles).not.toHaveBeenCalled();
    expect(api.getContactProfile).not.toHaveBeenCalled();
  });

  it('refreshes a stored value that does not parse as a claim', async () => {
    // A stored value can be stale junk (a bot published a malformed or
    // wrong-version claim it has since fixed). Every reader treats it as no
    // claim, so it must not pin the backfill off.
    for (const stored of [
      'not json',
      JSON.stringify({ v: 2, commands: [{ command: '/allow', title: 'A' }] }),
      JSON.stringify({ v: 1, commands: [] }),
    ]) {
      vi.clearAllMocks();
      resetBotInfoBackfillState();
      vi.mocked(db.getContact).mockResolvedValue(
        nonContactRow({ botInfo: stored })
      );
      vi.mocked(api.getContactProfile).mockResolvedValue({
        id: ship,
        botInfo: claim,
      } as db.Contact);

      await ensureBotInfoSynced(ship);

      expect(api.getContactProfile).toHaveBeenCalledWith(ship);
      expect(db.upsertContact).toHaveBeenCalledWith(
        expect.objectContaining({ id: ship, botInfo: claim })
      );
    }
  });

  it('backfills a never-met ship once contacts sync has settled', async () => {
    // The case the backfill exists for: `/v1/directory` omits peers whose
    // profile the ship holds nothing for, so a bot never met has no row at
    // all and never gets one from bulk sync.
    updateSession({ phase: 'ready' });
    vi.mocked(db.getContact).mockResolvedValue(null);
    vi.mocked(api.getContactProfile).mockResolvedValue({
      id: ship,
      botInfo: claim,
    } as db.Contact);

    await ensureBotInfoSynced(ship);

    expect(api.syncUserProfiles).toHaveBeenCalledWith([ship]);
    expect(api.getContactProfile).toHaveBeenCalledWith(ship);
    expect(db.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: ship, botInfo: claim })
    );
  });

  it('waits for contacts sync before acting on an absent row', async () => {
    // Before the initial contacts sync lands *every* row is absent, so
    // absence proves nothing and the ship may still be a contact-book entry
    // whose per-ship scry merges the user's mod overlay.
    vi.mocked(db.getContact).mockResolvedValue(null);
    vi.mocked(api.getContactProfile).mockResolvedValue(null);

    // More blocked attempts than the cap, so a counter that charged them would
    // exhaust the budget before sync ever settles — two would not.
    for (const phase of ['init', 'high', 'low', 'init'] as const) {
      updateSession({ phase });
      await ensureBotInfoSynced(ship);

      expect(api.syncUserProfiles).not.toHaveBeenCalled();
      expect(api.getContactProfile).not.toHaveBeenCalled();
    }

    // Blocked attempts are not counted against the cap, so the backfill still
    // gets its full allowance once sync settles.
    updateSession({ phase: 'ready' });
    await ensureBotInfoSynced(ship);

    expect(api.syncUserProfiles).toHaveBeenCalledWith([ship]);
    expect(api.getContactProfile).toHaveBeenCalledWith(ship);

    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);

    expect(api.getContactProfile).toHaveBeenCalledTimes(3);
  });

  it('waits for authoritative contacts sync before trusting a cached false row', async () => {
    // A present `isContact === false` row is no more authoritative than an
    // absent one before sync settles: it can come from the stale localStorage
    // snapshot, so the same phase gate applies.
    updateSession({ phase: 'low' });
    vi.mocked(db.getContact).mockResolvedValue(nonContactRow());

    await ensureBotInfoSynced(ship);

    expect(api.syncUserProfiles).not.toHaveBeenCalled();
    expect(api.getContactProfile).not.toHaveBeenCalled();

    // And the blocked attempt did not spend any of the cap.
    updateSession({ phase: 'ready' });
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);

    expect(api.getContactProfile).toHaveBeenCalledTimes(3);
  });

  it('skips rows whose isContact is null or undefined (unknown, not proven non-contact)', async () => {
    // The column is nullable and partial rows really occur (e.g.
    // blocked-contact inserts set no isContact). Unknown must not be treated
    // as proven false — the same mod-overlay hazard as the absent-row case.
    for (const isContact of [null, undefined]) {
      vi.clearAllMocks();
      resetBotInfoBackfillState();
      vi.mocked(db.getContact).mockResolvedValue(nonContactRow({ isContact }));

      await ensureBotInfoSynced(ship);

      expect(api.syncUserProfiles).not.toHaveBeenCalled();
      expect(api.getContactProfile).not.toHaveBeenCalled();
    }
  });

  it('backfills once an unknown isContact resolves to false', async () => {
    // The null → false transition is the fresh-start recovery path: a partial
    // row settles first, the full synced row lands later.
    vi.mocked(db.getContact).mockResolvedValue(
      nonContactRow({ isContact: null })
    );
    await ensureBotInfoSynced(ship);
    expect(api.syncUserProfiles).not.toHaveBeenCalled();

    vi.mocked(db.getContact).mockResolvedValue(nonContactRow());
    await ensureBotInfoSynced(ship);
    expect(api.syncUserProfiles).toHaveBeenCalledWith([ship]);
    expect(api.getContactProfile).toHaveBeenCalledWith(ship);
  });

  it('keeps skipping contact-book rows even when their stored claim is invalid', async () => {
    // The B-1 parse gate must not leak contact-book rows into the fetch path:
    // an unusable stored value on an isContact row still means "no backfill".
    vi.mocked(db.getContact).mockResolvedValue(
      nonContactRow({ isContact: true, botInfo: 'not json' })
    );

    await ensureBotInfoSynced(ship);

    expect(api.syncUserProfiles).not.toHaveBeenCalled();
    expect(api.getContactProfile).not.toHaveBeenCalled();
  });

  it('scopes backfill state by current user', async () => {
    vi.mocked(api.getContactProfile).mockResolvedValue(null);
    await ensureBotInfoSynced(ship);
    await ensureBotInfoSynced(ship);
    expect(api.getContactProfile).toHaveBeenCalledTimes(2);

    // Switching account starts a fresh budget; nothing else resets it.
    vi.mocked(api.getCurrentUserId).mockReturnValueOnce('~bus');
    await ensureBotInfoSynced(ship);
    expect(api.getContactProfile).toHaveBeenCalledTimes(3);
  });
});
