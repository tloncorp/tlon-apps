import type * as db from '@tloncorp/shared/db';
import type * as store from '@tloncorp/shared/store';
import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { ContactDiscoveryCompleted: 'Contact Discovery Completed' },
  createDevLogger: () => ({ trackError: vi.fn() }),
  trackEvent: vi.fn(),
}));
vi.mock('../../shared/src/db', () => ({}));
vi.mock('../../shared/src/debug', () => ({
  createDevLogger: () => ({ trackEvent: vi.fn() }),
}));
vi.mock('@tloncorp/shared/store', async () => {
  const actions = await vi.importActual<
    typeof import('@tloncorp/shared/store')
  >('../../shared/src/store/lanyardActions');
  return {
    invokeContactsMatchedHandler: actions.invokeContactsMatchedHandler,
    setContactsMatchedHandler: actions.setContactsMatchedHandler,
  };
});

import { setContactsMatchedHandler } from '@tloncorp/shared/store';
import { setupReactTestEnvironment } from '../test/sheetTestUtils';
import { useContactDiscovery } from './useContactDiscovery';

setupReactTestEnvironment();

const contacts: db.SystemContact[] = [
  { id: 'first-card', firstName: 'Same account', phoneNumber: '+15555550123' },
  {
    id: 'second-card',
    firstName: 'Same account alternate',
    phoneNumber: '+15555550124',
  },
  {
    id: 'unmatched-card',
    firstName: 'Can invite',
    phoneNumber: '+15555550125',
  },
];
const matches: [string, string][] = [
  [contacts[0].phoneNumber!, '~nec'],
  [contacts[1].phoneNumber!, '~nec'],
];

function renderDiscovery(discover: typeof store.syncContactDiscovery) {
  let current!: ReturnType<typeof useContactDiscovery>;
  function Probe() {
    const value = useContactDiscovery(discover);
    useLayoutEffect(() => {
      current = value;
    });
    return null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Probe />);
  });
  return {
    get current() {
      return current;
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

afterEach(() => {
  setContactsMatchedHandler(null);
  vi.clearAllMocks();
});

test('onboarding discovers both native cards for one saved account so neither remains invitable', async () => {
  const discover = vi
    .fn<
      Parameters<typeof store.syncContactDiscovery>,
      ReturnType<typeof store.syncContactDiscovery>
    >()
    .mockResolvedValue({
      didSucceed: true,
      didDiscover: true,
      newMatches: matches,
    });
  const hook = renderDiscovery(discover);
  await act(async () => {
    await hook.current.runDiscovery(contacts);
  });
  expect(hook.current.discoveredMatches.map((contact) => contact.id)).toEqual([
    'first-card',
    'second-card',
  ]);
  expect(hook.current.isDiscovering).toBe(false);
  hook.unmount();
});

test('advancing before discovery finishes preserves raw matches but notifies the shared handler once per account', async () => {
  let resolve!: (
    result: Awaited<ReturnType<typeof store.syncContactDiscovery>>
  ) => void;
  const pending = new Promise<
    Awaited<ReturnType<typeof store.syncContactDiscovery>>
  >((done) => {
    resolve = done;
  });
  const discover = vi
    .fn<
      Parameters<typeof store.syncContactDiscovery>,
      ReturnType<typeof store.syncContactDiscovery>
    >()
    .mockReturnValue(pending);
  const notified = vi.fn();
  setContactsMatchedHandler(notified);
  const hook = renderDiscovery(discover);
  let discovery!: Promise<void>;
  act(() => {
    discovery = hook.current.runDiscovery(contacts);
  });
  hook.current.notifyPendingMatches();
  hook.unmount();
  await act(async () => {
    resolve({ didSucceed: true, didDiscover: true, newMatches: matches });
    await discovery;
  });
  expect(notified).toHaveBeenCalledTimes(1);
  expect(notified).toHaveBeenCalledWith(['~nec']);
});
