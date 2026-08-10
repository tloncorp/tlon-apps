import * as api from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as db from '../../db';
import {
  ensureBotCommandsSynced,
  resetBotCommandsBackfillState,
} from '../contactActions';
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
const manifest = JSON.stringify({
  v: 1,
  commands: [{ command: '/allow', title: 'Allow' }],
});

// The C-3 recovery carrier: a `/v1/news` %peer fact mapped by the real
// contacts mapper and written by the real sync handler.
async function deliverPeerFact(who: string, botCommands: string) {
  const contact = api.v1PeerToClientProfile(who, {
    'bot-commands': { type: 'text', value: botCommands },
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

describe('ensureBotCommandsSynced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBotCommandsBackfillState();
    vi.mocked(db.getContact).mockResolvedValue(nonContactRow());
    vi.mocked(api.getContactProfile).mockResolvedValue(null);
  });

  it('meets the ship and upserts the fetched profile', async () => {
    vi.mocked(api.getContactProfile).mockResolvedValue({
      id: ship,
      botCommands: manifest,
    } as db.Contact);

    await ensureBotCommandsSynced(ship);

    expect(api.syncUserProfiles).toHaveBeenCalledWith([ship]);
    expect(api.getContactProfile).toHaveBeenCalledWith(ship);
    expect(db.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: ship, botCommands: manifest })
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
      ensureBotCommandsSynced(ship),
      ensureBotCommandsSynced(ship),
    ]);
    releaseContact!();
    await both;

    expect(api.syncUserProfiles).toHaveBeenCalledTimes(1);
    expect(api.getContactProfile).toHaveBeenCalledTimes(1);
  });

  it('retries after a scry miss (first scry races the %meet watch)', async () => {
    vi.mocked(api.getContactProfile).mockResolvedValueOnce(null);

    await ensureBotCommandsSynced(ship);
    expect(db.upsertContact).not.toHaveBeenCalled();

    // The profile arrives on a later attempt (scry or subscription-fed).
    vi.mocked(api.getContactProfile).mockResolvedValueOnce({
      id: ship,
      botCommands: manifest,
    } as db.Contact);
    await ensureBotCommandsSynced(ship);
    expect(db.upsertContact).toHaveBeenCalledTimes(1);
  });

  it('scry misses, then the profile lands via the subscription path', async () => {
    // First attempt races the %meet watch: the scry 404s.
    vi.mocked(api.getContactProfile).mockResolvedValueOnce(null);
    await ensureBotCommandsSynced(ship);
    expect(db.upsertContact).not.toHaveBeenCalled();

    // The %peer fact then arrives through the real contacts subscription and
    // is written by the real sync handler — no hand-rolled upsert here, so
    // breaking either carrier fails this test.
    await deliverPeerFact(ship, manifest);
    expect(db.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: ship, botCommands: manifest }),
      undefined
    );

    // A later hook evaluation sees the stored manifest and stops fetching.
    vi.mocked(db.getContact).mockResolvedValueOnce(
      nonContactRow({ botCommands: manifest })
    );
    await ensureBotCommandsSynced(ship);
    expect(api.getContactProfile).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure; failures are not cached as done', async () => {
    vi.mocked(api.getContactProfile)
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({ id: ship, botCommands: manifest } as db.Contact);

    await ensureBotCommandsSynced(ship);
    expect(db.upsertContact).not.toHaveBeenCalled();

    await ensureBotCommandsSynced(ship);
    expect(db.upsertContact).toHaveBeenCalledTimes(1);
  });

  it('bounds retries per ship per session', async () => {
    vi.mocked(api.getContactProfile).mockResolvedValue(null);

    await ensureBotCommandsSynced(ship);
    await ensureBotCommandsSynced(ship);
    await ensureBotCommandsSynced(ship);
    await ensureBotCommandsSynced(ship);
    await ensureBotCommandsSynced(ship);

    expect(api.getContactProfile).toHaveBeenCalledTimes(3);
  });

  it('skips contact-book rows (they arrive lossless via v1 /book)', async () => {
    vi.mocked(db.getContact).mockResolvedValue({
      id: ship,
      isContact: true,
    } as unknown as Awaited<ReturnType<typeof db.getContact>>);

    await ensureBotCommandsSynced(ship);

    expect(api.syncUserProfiles).not.toHaveBeenCalled();
    expect(api.getContactProfile).not.toHaveBeenCalled();
  });

  it('skips ships that already advertise a usable manifest', async () => {
    vi.mocked(db.getContact).mockResolvedValue(
      nonContactRow({ botCommands: manifest })
    );

    await ensureBotCommandsSynced(ship);

    expect(api.syncUserProfiles).not.toHaveBeenCalled();
    expect(api.getContactProfile).not.toHaveBeenCalled();
  });

  it('refreshes a stored value that does not parse as a manifest', async () => {
    // A v0 `/all` sync preserves whatever was there; if that value is stale
    // junk, wrong-version or oversized, every reader treats it as no manifest,
    // so it must not pin the backfill off.
    for (const stored of [
      'not json',
      JSON.stringify({ v: 2, commands: [{ command: '/allow', title: 'A' }] }),
      JSON.stringify({ v: 1, commands: [] }),
    ]) {
      vi.clearAllMocks();
      resetBotCommandsBackfillState();
      vi.mocked(db.getContact).mockResolvedValue(
        nonContactRow({ botCommands: stored })
      );
      vi.mocked(api.getContactProfile).mockResolvedValue({
        id: ship,
        botCommands: manifest,
      } as db.Contact);

      await ensureBotCommandsSynced(ship);

      expect(api.getContactProfile).toHaveBeenCalledWith(ship);
      expect(db.upsertContact).toHaveBeenCalledWith(
        expect.objectContaining({ id: ship, botCommands: manifest })
      );
    }
  });

  it('skips ships with no known contact row yet', async () => {
    // An absent row proves nothing: the ship may still turn out to be a
    // contact-book entry, whose per-ship scry merges the user's mod overlay.
    vi.mocked(db.getContact).mockResolvedValue(null);

    await ensureBotCommandsSynced(ship);

    expect(api.syncUserProfiles).not.toHaveBeenCalled();
    expect(api.getContactProfile).not.toHaveBeenCalled();
  });

  it('skips rows whose isContact is null or undefined (unknown, not proven non-contact)', async () => {
    // The column is nullable and partial rows really occur (e.g.
    // blocked-contact inserts set no isContact). Unknown must not be treated
    // as proven false — the same mod-overlay hazard as the absent-row case.
    for (const isContact of [null, undefined]) {
      vi.clearAllMocks();
      resetBotCommandsBackfillState();
      vi.mocked(db.getContact).mockResolvedValue(nonContactRow({ isContact }));

      await ensureBotCommandsSynced(ship);

      expect(api.syncUserProfiles).not.toHaveBeenCalled();
      expect(api.getContactProfile).not.toHaveBeenCalled();
    }
  });

  it('backfills once an unknown isContact resolves to false', async () => {
    // The null → false transition is the fresh-start recovery path: a partial
    // row settles first, the provenance-carrying write lands later.
    vi.mocked(db.getContact).mockResolvedValue(
      nonContactRow({ isContact: null })
    );
    await ensureBotCommandsSynced(ship);
    expect(api.syncUserProfiles).not.toHaveBeenCalled();

    vi.mocked(db.getContact).mockResolvedValue(nonContactRow());
    await ensureBotCommandsSynced(ship);
    expect(api.syncUserProfiles).toHaveBeenCalledWith([ship]);
    expect(api.getContactProfile).toHaveBeenCalledWith(ship);
  });

  it('keeps skipping contact-book rows even when their stored manifest is invalid', async () => {
    // The B-1 parse gate must not leak contact-book rows into the fetch path:
    // an unusable stored value on an isContact row still means "no backfill".
    vi.mocked(db.getContact).mockResolvedValue(
      nonContactRow({ isContact: true, botCommands: 'not json' })
    );

    await ensureBotCommandsSynced(ship);

    expect(api.syncUserProfiles).not.toHaveBeenCalled();
    expect(api.getContactProfile).not.toHaveBeenCalled();
  });

  it('scopes backfill state by current user', async () => {
    vi.mocked(api.getContactProfile).mockResolvedValue(null);
    await ensureBotCommandsSynced(ship);
    await ensureBotCommandsSynced(ship);
    expect(api.getContactProfile).toHaveBeenCalledTimes(2);

    // Switching account resets the per-session bookkeeping.
    vi.mocked(api.getCurrentUserId).mockReturnValueOnce('~bus');
    await ensureBotCommandsSynced(ship);
    expect(api.getContactProfile).toHaveBeenCalledTimes(3);
  });
});
