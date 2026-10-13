import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';
import type { StewardAutomationSnapshot } from './useStewardAutomationTasks';

const ownBot = '~pinser-botter-sampel-palnet';
const otherBot = '~pinser-botter-dozzod-dozzod';

const node = vi.hoisted(() => ({
  trustBot: vi.fn(),
  read: vi.fn(),
  // What the query cache holds, which the feed and reads both fill.
  cache: undefined as unknown,
}));

vi.mock('@tloncorp/api', () => ({
  getBotUserIdForUser: (id: string) =>
    id ? `~pinser-botter-${id.replace(/^~/, '')}` : '',
  getCurrentUserId: () => '~sampel-palnet',
  trustBot: node.trustBot,
}));
vi.mock('@tloncorp/shared', () => ({
  queryClient: {
    refetchQueries: node.read,
    getQueryData: () => node.cache,
  },
}));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUserId: () => '~sampel-palnet',
}));
// False stands for "off" and for "hosting has not answered yet" alike.
const hosting = vi.hoisted(() => ({ botEnabled: true }));
vi.mock('../../utils/botSettings', () => ({
  useBotEnabled: () => hosting.botEnabled,
}));
vi.mock('./useStewardAutomationTasks', () => ({
  stewardAutomationQueryKey: ['stewardAutomationTasks'],
  tasksForShip: (
    snapshot: StewardAutomationSnapshot | undefined,
    ship: string
  ) => snapshot?.tasks[ship],
}));

setupReactTestEnvironment();

type Query = {
  data?: StewardAutomationSnapshot;
  isSuccess: boolean;
  isFetching: boolean;
  isFetchedAfterMount: boolean;
};

const noList: StewardAutomationSnapshot = { available: true, tasks: {} };
const withList: StewardAutomationSnapshot = {
  available: true,
  tasks: { [ownBot]: {} },
};
const read = (data: StewardAutomationSnapshot): Query => ({
  data,
  isSuccess: true,
  isFetching: false,
  isFetchedAfterMount: true,
});
const fromCacheOnly = (data: StewardAutomationSnapshot): Query => ({
  ...read(data),
  isFetching: true,
  isFetchedAfterMount: false,
});

// The repair is kept for as long as the app is open, so each test loads the
// module afresh: a new app session.
async function openApp() {
  vi.resetModules();
  const { useTaskListRepair } = await import('./useTaskListRepair');
  return function openScreen(botShip: string, query: Query) {
    let latest: ReturnType<typeof useTaskListRepair>;
    function Screen({ shown }: { shown: Query }) {
      const current = useTaskListRepair(botShip, shown);
      useLayoutEffect(() => {
        latest = current;
      });
      return null;
    }
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(<Screen shown={query} />);
    });
    return {
      get attempt() {
        return latest.attempt;
      },
      refresh: () => act(() => latest.refresh()),
      show: (next: Query) => act(() => tree.update(<Screen shown={next} />)),
      close: () => act(() => tree.unmount()),
    };
  };
}

const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  hosting.botEnabled = true;
  node.trustBot.mockReset().mockResolvedValue(1);
  node.read.mockReset().mockResolvedValue(undefined);
  node.cache = noList;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTaskListRepair', () => {
  it("asks the node for the owner's bot once a missing list is seen", async () => {
    const openScreen = await openApp();
    const screen = openScreen(ownBot, read(noList));

    expect(screen.attempt).toBe('asking');
    await wait(0);
    expect(node.trustBot).toHaveBeenCalledTimes(1);
    expect(node.trustBot).toHaveBeenCalledWith(ownBot);
  });

  it('shows the list as soon as it arrives, and says nothing more', async () => {
    const openScreen = await openApp();
    const screen = openScreen(ownBot, read(noList));

    node.cache = withList;
    await wait(1_000);
    screen.show(read(withList));

    expect(screen.attempt).toBeUndefined();
    expect(node.trustBot).toHaveBeenCalledTimes(1);
  });

  it('says so when the bot has still not sent its list', async () => {
    const openScreen = await openApp();
    const screen = openScreen(ownBot, read(noList));

    await wait(14_000);
    expect(screen.attempt).toBe('asking');
    await wait(2_000);

    expect(screen.attempt).toBe('nothing');
    expect(node.trustBot).toHaveBeenCalledTimes(1);
  });

  it('does not ask by itself again while the app stays open', async () => {
    const openScreen = await openApp();
    const first = openScreen(ownBot, read(noList));
    await wait(16_000);
    first.close();

    const second = openScreen(ownBot, read(noList));
    await wait(16_000);

    expect(node.trustBot).toHaveBeenCalledTimes(1);
    expect(second.attempt).toBe('nothing');
  });

  it('asks again on a refresh, busy until it knows', async () => {
    const openScreen = await openApp();
    const screen = openScreen(ownBot, read(noList));
    await wait(16_000);

    screen.refresh();
    expect(screen.attempt).toBe('asking');
    await wait(16_000);

    expect(screen.attempt).toBe('nothing');
    expect(node.trustBot).toHaveBeenCalledTimes(2);
    expect(node.trustBot).toHaveBeenLastCalledWith(ownBot);
  });

  it('says when the node could not be asked', async () => {
    const openScreen = await openApp();
    node.trustBot.mockRejectedValue(new Error('nack'));
    const screen = openScreen(ownBot, read(noList));

    await wait(0);

    expect(screen.attempt).toBe('failed');
  });

  it('waits for a read made since the screen opened', async () => {
    const openScreen = await openApp();
    const screen = openScreen(ownBot, fromCacheOnly(noList));

    await wait(0);
    expect(node.trustBot).not.toHaveBeenCalled();
    // On its way, so the row is busy rather than offering a refresh.
    expect(screen.attempt).toBe('asking');

    screen.show(read(noList));
    await wait(0);
    expect(node.trustBot).toHaveBeenCalledTimes(1);
  });

  it('asks nothing when that read brings the list', async () => {
    const openScreen = await openApp();
    const screen = openScreen(ownBot, fromCacheOnly(noList));

    screen.show(read(withList));
    await wait(16_000);

    expect(node.trustBot).not.toHaveBeenCalled();
    expect(screen.attempt).toBeUndefined();
  });

  it('leaves a node without the task module alone', async () => {
    const openScreen = await openApp();
    const screen = openScreen(ownBot, read({ available: false, tasks: {} }));

    await wait(16_000);

    expect(node.trustBot).not.toHaveBeenCalled();
    expect(screen.attempt).toBeUndefined();
  });

  it.each([otherBot, '~zod'])(
    'never asks the node to trust %s, a ship that is not the owner’s bot',
    async (ship) => {
      const openScreen = await openApp();
      const screen = openScreen(ship, read(noList));

      await wait(16_000);
      expect(screen.attempt).toBeUndefined();

      screen.refresh();
      await wait(16_000);

      expect(node.trustBot).not.toHaveBeenCalled();
      // The refresh still read the mirror, and says what it found.
      expect(node.read).toHaveBeenCalledTimes(1);
      expect(screen.attempt).toBe('notAsked');
    }
  );

  describe('while hosting has not said the bot is turned on', () => {
    beforeEach(() => {
      hosting.botEnabled = false;
    });

    it('does not tell the node by itself', async () => {
      const openScreen = await openApp();
      const screen = openScreen(ownBot, read(noList));

      await wait(16_000);

      expect(node.trustBot).not.toHaveBeenCalled();
      expect(screen.attempt).toBeUndefined();
    });

    it('reads again on a refresh, busy, and ends without blaming a slow bot', async () => {
      const openScreen = await openApp();
      let finishRead = () => {};
      node.read.mockImplementationOnce(
        () => new Promise<void>((resolve) => (finishRead = resolve))
      );
      const screen = openScreen(ownBot, read(noList));

      screen.refresh();
      expect(screen.attempt).toBe('checking');
      finishRead();
      await wait(0);

      expect(screen.attempt).toBe('notAsked');
      expect(node.read).toHaveBeenCalledTimes(1);
      expect(node.trustBot).not.toHaveBeenCalled();
    });

    it('shows a list that the refresh finds', async () => {
      const openScreen = await openApp();
      const screen = openScreen(ownBot, read(noList));
      node.read.mockImplementationOnce(async () => {
        node.cache = withList;
      });

      screen.refresh();
      await wait(0);
      screen.show(read(withList));

      expect(screen.attempt).toBeUndefined();
      expect(node.trustBot).not.toHaveBeenCalled();
    });

    it('tells the node once, when the answer comes after the screen opened', async () => {
      const openScreen = await openApp();
      const screen = openScreen(ownBot, read(noList));
      await wait(5_000);
      expect(node.trustBot).not.toHaveBeenCalled();

      hosting.botEnabled = true;
      screen.show(read(noList));
      expect(screen.attempt).toBe('asking');
      await wait(16_000);

      expect(node.trustBot).toHaveBeenCalledTimes(1);
      expect(node.trustBot).toHaveBeenCalledWith(ownBot);
      expect(screen.attempt).toBe('nothing');
    });

    it('still tells the node once after an early refresh that only read', async () => {
      const openScreen = await openApp();
      const screen = openScreen(ownBot, read(noList));
      screen.refresh();
      await wait(0);
      expect(screen.attempt).toBe('notAsked');

      hosting.botEnabled = true;
      screen.show(read(noList));
      await wait(16_000);

      expect(node.trustBot).toHaveBeenCalledTimes(1);
    });
  });

  it('stops telling the node on a refresh once the bot is turned off', async () => {
    const openScreen = await openApp();
    const screen = openScreen(ownBot, read(noList));
    await wait(16_000);
    expect(node.trustBot).toHaveBeenCalledTimes(1);

    hosting.botEnabled = false;
    screen.show(read(noList));
    screen.refresh();
    await wait(16_000);

    expect(node.trustBot).toHaveBeenCalledTimes(1);
    expect(screen.attempt).toBe('notAsked');
  });
});
