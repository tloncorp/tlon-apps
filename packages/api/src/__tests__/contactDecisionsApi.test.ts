import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  discoverContact,
  probeContactDecisions,
  removeContactSuggestion,
} from '../client/contactsApi';
import {
  BadResponseError,
  poke,
  scry,
  setDeskSupportsContactDecisions,
  setDeskSupportsContactRemoval,
} from '../client/urbit';

vi.mock('../client/urbit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client/urbit')>()),
  poke: vi.fn(),
  scry: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(poke).mockResolvedValue(1);
  setDeskSupportsContactDecisions(null);
  setDeskSupportsContactRemoval(null);
});

afterEach(() => {
  setDeskSupportsContactDecisions(null);
  setDeskSupportsContactRemoval(null);
  vi.clearAllMocks();
});

test.each([undefined, null, 'Chosen address book name'])(
  'complete discovery sends its required nullable promotion field: %s',
  async (nickname) => {
    setDeskSupportsContactDecisions(true);
    await discoverContact('~nec', nickname);
    expect(poke).toHaveBeenCalledWith({
      app: 'contacts',
      mark: 'contact-discover-1',
      json: { kip: '~nec', nickname: nickname ?? null },
    });
  }
);

test('a removal-only desk keeps the original discovery mark and cannot receive a promotion field', async () => {
  setDeskSupportsContactRemoval(true);
  setDeskSupportsContactDecisions(false);
  await discoverContact('~nec', 'Local name');
  expect(poke).toHaveBeenCalledWith({
    app: 'contacts',
    mark: 'contact-discover',
    json: '~nec',
  });
});

test.each([null, false])(
  'older or unknown desks retain the legacy save and hide path (%s)',
  async (support) => {
    setDeskSupportsContactDecisions(support);
    await discoverContact('~nec', 'Local name');
    expect(poke).toHaveBeenCalledWith({
      app: 'contacts',
      mark: 'contact-action-1',
      json: { page: { kip: '~nec', contact: {} } },
    });
    expect(poke).not.toHaveBeenCalledWith(
      expect.objectContaining({ mark: 'contact-discover-1' })
    );
  }
);

test('complete Decline uses contacts ownership, while unsupported and unknown desks retain legacy hide', async () => {
  setDeskSupportsContactDecisions(true);
  await removeContactSuggestion('~nec');
  expect(poke).toHaveBeenLastCalledWith({
    app: 'contacts',
    mark: 'contact-decline-1',
    json: '~nec',
  });
  for (const support of [null, false]) {
    setDeskSupportsContactDecisions(support);
    await removeContactSuggestion('~nec');
    expect(poke).toHaveBeenLastCalledWith({
      app: 'groups-ui',
      mark: 'ui-hide-contact',
      json: '~nec',
    });
  }
});

test('complete capability probes contacts state and the groups-ui enforcement marker', async () => {
  vi.mocked(scry)
    .mockResolvedValueOnce({
      directory: {},
      book: {},
      removed: [],
      declined: [],
    })
    .mockResolvedValueOnce(true);
  await probeContactDecisions();
  expect(vi.mocked(scry).mock.calls).toEqual([
    [{ app: 'contacts', path: '/v3/init' }],
    [{ app: 'groups-ui', path: '/v1/contact-decline-protection' }],
  ]);
});

test.each([404, 403, 503])(
  'the groups-ui marker failure remains an HTTP %s error for capability policy',
  async (status) => {
    const error = new BadResponseError(status, 'marker unavailable');
    vi.mocked(scry)
      .mockResolvedValueOnce({
        directory: {},
        book: {},
        removed: [],
        declined: [],
      })
      .mockRejectedValueOnce(error);
    await expect(probeContactDecisions()).rejects.toBe(error);
    expect(scry).toHaveBeenLastCalledWith({
      app: 'groups-ui',
      path: '/v1/contact-decline-protection',
    });
  }
);

test('a missing contacts contract stops the probe before groups-ui', async () => {
  const error = new BadResponseError(404, 'state unavailable');
  vi.mocked(scry).mockRejectedValueOnce(error);
  await expect(probeContactDecisions()).rejects.toBe(error);
  expect(scry).toHaveBeenCalledTimes(1);
});
