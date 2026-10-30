import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  discoverContact,
  removeContactSuggestion,
} from '../client/contactsApi';
import {
  poke,
  setDeskSupportsContactDecisions,
  setDeskSupportsContactRemoval,
} from '../client/urbit';

vi.mock('../client/urbit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client/urbit')>()),
  poke: vi.fn(),
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
