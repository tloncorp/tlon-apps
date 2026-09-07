import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ConversationComputingState } from './useConversationComputingState';
import { ThinkingState } from './ThinkingState';
import { ConversationListDiagnosticsContext } from './PostList/diagnostics';

const mocks = vi.hoisted(() => ({
  computing: null as ConversationComputingState | null,
}));

vi.mock('./useConversationComputingState', () => ({
  useConversationComputingState: () => mocks.computing,
}));

vi.mock('../Avatar', () => ({ ContactAvatar: 'ContactAvatar' }));
vi.mock('@tloncorp/ui', () => ({ Text: 'Text' }));
vi.mock('tamagui', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  Spinner: 'Spinner',
  View: 'View',
  XStack: 'XStack',
}));

const computing = (): ConversationComputingState => ({
  ships: [{ ship: '~bot', label: 'Thinking...', toolCalls: [] }],
  label: 'Thinking...',
  toolCalls: [],
});

describe('ThinkingState', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.computing = null;
  });

  it('does not mount an animated spinner while hidden', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ThinkingState conversationId="chat" channelType="chat" />
      );
    });

    expect(
      renderer!.root.findAll((node) => (node.type as unknown) === 'Spinner')
    ).toHaveLength(0);
    expect(
      renderer!.root.find((node) => (node.type as unknown) === 'View').props
        .height
    ).toBe(0);
    act(() => renderer!.unmount());
  });

  it('collapses when a response arrives before overlapping computing ends', async () => {
    let renderer: ReactTestRenderer;
    mocks.computing = computing();
    await act(async () => {
      renderer = create(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-0"
          latestPostAuthorId="~ten"
        />
      );
    });

    mocks.computing = null;
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-0"
          latestPostAuthorId="~ten"
        />
      );
    });

    mocks.computing = computing();
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-0"
          latestPostAuthorId="~ten"
        />
      );
    });

    // The response can land before presence clears; it still completes the
    // active cycle and must not leave the footer held for its timeout.
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-1"
          latestPostAuthorId="~bot"
        />
      );
    });
    mocks.computing = null;
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-1"
          latestPostAuthorId="~bot"
        />
      );
    });

    expect(
      renderer!.root.find((node) => (node.type as unknown) === 'View').props
        .height
    ).toBe(0);
    act(() => renderer!.unmount());
  });

  it('uses the preceding idle post when thinking and its response render together', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-0"
          latestPostAuthorId="~ten"
        />
      );
    });

    mocks.computing = computing();
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-1"
          latestPostAuthorId="~bot"
        />
      );
    });
    mocks.computing = null;
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-1"
          latestPostAuthorId="~bot"
        />
      );
    });

    expect(
      renderer!.root.find((node) => (node.type as unknown) === 'View').props
        .height
    ).toBe(0);
    act(() => renderer!.unmount());
  });

  it('remembers a response when a later member post becomes latest', async () => {
    let renderer: ReactTestRenderer;
    mocks.computing = computing();
    await act(async () => {
      renderer = create(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-0"
          latestPostAuthorId="~ten"
        />
      );
    });

    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-1"
          latestPostAuthorId="~bot"
        />
      );
    });
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-2"
          latestPostAuthorId="~other"
        />
      );
    });
    mocks.computing = null;
    await act(async () => {
      renderer!.update(
        <ThinkingState
          conversationId="chat"
          channelType="chat"
          latestPostId="post-2"
          latestPostAuthorId="~other"
        />
      );
    });

    expect(
      renderer!.root.find((node) => (node.type as unknown) === 'View').props
        .height
    ).toBe(0);
    act(() => renderer!.unmount());
  });

  describe('presence and response ordering', () => {
    let renderer: ReactTestRenderer | undefined;
    let latestPostId: string;
    let latestPostAuthorId: string;
    let forcedLabel: string | undefined;

    const render = async () => {
      await act(async () => {
        const element = (
          <ThinkingState
            conversationId="chat"
            channelType="chat"
            latestPostId={latestPostId}
            latestPostAuthorId={latestPostAuthorId}
            forcedLabel={forcedLabel}
          />
        );
        if (renderer) renderer.update(element);
        else renderer = create(element);
      });
    };
    const footer = () =>
      renderer!.root.findAll((node) => (node.type as unknown) === 'View')[0];
    const height = () => footer().props.height;
    const tick = async (ms: number) => {
      await act(async () => {
        vi.advanceTimersByTime(ms);
      });
    };
    const respond = () => {
      latestPostId = 'bot-response';
      latestPostAuthorId = '~bot';
    };

    beforeEach(async () => {
      // Control the production grace period without replacing React's immediate queue.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      renderer = undefined;
      latestPostId = 'idle-post';
      latestPostAuthorId = '~member';
      forcedLabel = undefined;
      await render();
      mocks.computing = computing();
      await render();
      expect(height()).toBe(52);
    });

    afterEach(() => {
      if (renderer) act(() => renderer!.unmount());
      renderer = undefined;
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it.each(['stop-first', 'response-first', 'same-render'])(
      'keeps a mounted footer and completes the handoff: %s',
      async (order) => {
        const initialFooter = footer();
        if (order === 'stop-first') {
          mocks.computing = null;
          await render();
          expect(height()).toBe(52);
          await tick(300);
          respond();
        } else if (order === 'response-first') {
          respond();
          await render();
          expect(height()).toBe(52);
          mocks.computing = null;
        } else {
          respond();
          mocks.computing = null;
        }
        await render();
        expect(footer()).toBe(initialFooter);
        expect(height()).toBe(0);
        expect(
          renderer!.root.findAll((node) => (node.type as unknown) === 'Spinner')
        ).toHaveLength(0);
      }
    );

    it('holds through the grace interval and expires without a reply', async () => {
      mocks.computing = null;
      await render();
      await tick(1999);
      expect(height()).toBe(52);
      await tick(1);
      expect(height()).toBe(0);
      expect(footer().props.accessibilityElementsHidden).toBe(true);
    });

    it('does not treat an unrelated member message as the bot response', async () => {
      mocks.computing = null;
      latestPostId = 'another-member-post';
      latestPostAuthorId = '~unrelated';
      await render();
      expect(height()).toBe(52);
      await tick(1999);
      expect(height()).toBe(52);
      respond();
      await render();
      expect(height()).toBe(0);
    });

    it('cancels an old expiry when computing restarts', async () => {
      mocks.computing = null;
      await render();
      await tick(1000);
      mocks.computing = computing();
      await render();
      await tick(3000);
      expect(height()).toBe(52);
      mocks.computing = null;
      await render();
      await tick(1999);
      expect(height()).toBe(52);
      await tick(1);
      expect(height()).toBe(0);
    });

    it('does not restart the grace timer on unrelated rerenders', async () => {
      mocks.computing = null;
      await render();
      await tick(1200);
      latestPostId = 'unrelated-post';
      latestPostAuthorId = '~member';
      await render();
      await tick(800);
      expect(height()).toBe(0);
    });

    it('retains another active bot when one bot stops', async () => {
      mocks.computing = {
        ships: [
          ...computing().ships,
          { ship: '~second', label: 'Searching...', toolCalls: [] },
        ],
        label: 'Two bots are thinking...',
        toolCalls: [],
      };
      await render();
      expect(
        renderer!.root.findAll(
          (node) => (node.type as unknown) === 'ContactAvatar'
        )
      ).toHaveLength(2);
      mocks.computing = {
        ships: [{ ship: '~second', label: 'Searching...', toolCalls: [] }],
        label: 'Searching...',
        toolCalls: [],
      };
      respond();
      await render();
      expect(height()).toBe(52);
      expect(
        renderer!.root.findAll(
          (node) => (node.type as unknown) === 'ContactAvatar'
        )
      ).toHaveLength(1);
    });

    it('keeps a forced setup label visible until that label clears', async () => {
      forcedLabel = 'Writing your first entry...';
      respond();
      mocks.computing = null;
      await render();
      await tick(3000);
      expect(height()).toBe(52);
      forcedLabel = undefined;
      await render();
      expect(height()).toBe(0);
    });

    it('cleans a pending expiry when the scoped footer unmounts', async () => {
      const schedule = vi.spyOn(globalThis, 'setTimeout');
      const clear = vi.spyOn(globalThis, 'clearTimeout');
      mocks.computing = null;
      await render();
      const expiryIndex = schedule.mock.calls.findIndex(
        ([, delay]) => delay === 2000
      );
      expect(expiryIndex).toBeGreaterThanOrEqual(0);
      const expiryHandle = schedule.mock.results[expiryIndex].value;
      act(() => renderer!.unmount());
      renderer = undefined;
      expect(clear).toHaveBeenCalledWith(expiryHandle);
      await tick(3000);
    });
  });

  // These observe real React lifecycle commits with the production timer.
  // They do not measure native/browser layout, animation, or presented frames.
  describe('grace timer races without stale visibility commits', () => {
    let renderer: ReactTestRenderer | undefined;
    let conversationId: string;
    let events: {
      name: string;
      time: number;
      values?: Record<string, number | string | boolean>;
    }[];
    let diagnostics: React.ContextType<
      typeof ConversationListDiagnosticsContext
    >;

    const render = async () => {
      await act(async () => {
        const element = (
          <ConversationListDiagnosticsContext.Provider value={diagnostics}>
            <ThinkingState
              key={conversationId}
              conversationId={conversationId}
              channelType="chat"
              latestPostId={`${conversationId}-idle`}
              latestPostAuthorId="~member"
            />
          </ConversationListDiagnosticsContext.Provider>
        );
        if (renderer) renderer.update(element);
        else renderer = create(element);
      });
    };
    const footer = () =>
      renderer!.root.findAll((node) => (node.type as unknown) === 'View')[0];
    const tick = async (ms: number) => {
      await act(async () => {
        vi.advanceTimersByTime(ms);
      });
    };
    const commits = (scope = conversationId) =>
      events.filter(
        (event) =>
          event.name === 'thinking-commit' &&
          event.values?.conversationId === scope
      );
    const changeComputing = async (active: boolean) => {
      mocks.computing = active ? computing() : null;
      await render();
    };

    beforeEach(async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      renderer = undefined;
      conversationId = 'scope-a';
      events = [];
      diagnostics = {
        attach: () => () => {},
        event: (name, values) => {
          events.push({ name, values, time: Date.now() });
        },
      };
      await render();
      await changeComputing(true);
      expect(footer().props.height).toBe(52);
      events.length = 0;
    });
    afterEach(() => {
      if (renderer) act(() => renderer!.unmount());
      renderer = undefined;
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('restarts1ms before expiry without hiding, then collapses once at the new deadline', async () => {
      const initialFooter = footer();
      const schedule = vi.spyOn(globalThis, 'setTimeout');
      const clear = vi.spyOn(globalThis, 'clearTimeout');
      await changeComputing(false);
      const oldExpiry =
        schedule.mock.results[
          schedule.mock.calls.findIndex(([, delay]) => delay === 2000)
        ].value;
      await tick(1999);
      await changeComputing(true);
      expect(clear).toHaveBeenCalledWith(oldExpiry);
      await tick(1); // The old deadline is now due, with computing active.
      expect(footer()).toBe(initialFooter);
      expect(footer().props.height).toBe(52);
      expect(footer().props.opacity).toBe(1);
      expect(commits().some((event) => event.values?.visible === false)).toBe(
        false
      );
      await tick(500);
      await changeComputing(false);
      const clearedAt = Date.now();
      await tick(1999);
      expect(footer().props.height).toBe(52);
      expect(commits().some((event) => event.values?.visible === false)).toBe(
        false
      );
      await tick(1);
      expect(footer()).toBe(initialFooter);
      expect(footer().props.height).toBe(0);
      expect(footer().props.opacity).toBe(0);
      expect(
        commits().filter((event) => event.values?.visible === false)
      ).toMatchObject([{ time: clearedAt + 2000 }]);
      const terminalCommits = [...commits()];
      await tick(4000);
      expect(commits()).toEqual(terminalCommits);
      expect(
        renderer!.root.findAll((node) => (node.type as unknown) === 'Spinner')
      ).toHaveLength(0);
    });

    it('cancels every superseded expiry across repeated clear/restart cycles', async () => {
      const initialFooter = footer();
      const schedule = vi.spyOn(globalThis, 'setTimeout');
      const clear = vi.spyOn(globalThis, 'clearTimeout');
      for (const delay of [25, 999, 1999]) {
        await changeComputing(false);
        await tick(delay);
        await changeComputing(true);
        await tick(2001 - delay); // Cross this cycle's abandoned deadline.
        expect(footer()).toBe(initialFooter);
        expect(footer().props.height).toBe(52);
        expect(commits().some((event) => event.values?.visible === false)).toBe(
          false
        );
      }
      const expiryCalls = schedule.mock.calls.flatMap(([, delay], index) =>
        delay === 2000 ? [schedule.mock.results[index].value] : []
      );
      expect(expiryCalls).toHaveLength(3);
      for (const handle of expiryCalls)
        expect(clear).toHaveBeenCalledWith(handle);
      await changeComputing(false);
      await tick(1999);
      expect(footer().props.height).toBe(52);
      await tick(1);
      expect(
        commits().filter((event) => event.values?.visible === false)
      ).toHaveLength(1);
      await tick(6000);
      expect(
        commits().filter((event) => event.values?.visible === false)
      ).toHaveLength(1);
      expect(footer().props.height).toBe(0);
    });

    it('does not publish stale commits after unmount and a keyed scope replacement', async () => {
      const oldFooter = footer();
      const schedule = vi.spyOn(globalThis, 'setTimeout');
      const clear = vi.spyOn(globalThis, 'clearTimeout');
      await changeComputing(false);
      const oldExpiry =
        schedule.mock.results[
          schedule.mock.calls.findIndex(([, delay]) => delay === 2000)
        ].value;
      await tick(1000);
      act(() => renderer!.unmount());
      renderer = undefined;
      expect(clear).toHaveBeenCalledWith(oldExpiry);
      const oldScopeCommits = [...commits('scope-a')];
      conversationId = 'scope-b';
      mocks.computing = computing();
      await render();
      expect(footer()).not.toBe(oldFooter);
      expect(footer().props.height).toBe(52);
      await tick(1001); // Old scope's timeout would have fired by now.
      expect(commits('scope-a')).toEqual(oldScopeCommits);
      expect(
        commits('scope-b').every((event) => event.values?.visible === true)
      ).toBe(true);
      expect(footer().props.height).toBe(52);
      await changeComputing(false);
      const replacementClearedAt = Date.now();
      await tick(1999);
      expect(footer().props.height).toBe(52);
      await tick(1);
      expect(
        commits('scope-b').filter((event) => event.values?.visible === false)
      ).toMatchObject([{ time: replacementClearedAt + 2000 }]);
      const terminalCommits = [...events];
      await tick(4000);
      expect(events).toEqual(terminalCommits);
      expect(commits('scope-a')).toEqual(oldScopeCommits);
    });
  });
});
