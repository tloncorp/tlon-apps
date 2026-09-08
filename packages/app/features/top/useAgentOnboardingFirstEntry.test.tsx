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

import {
  AGENT_ONBOARDING_FIRST_ENTRY_STATUSES,
  useAgentOnboardingFirstEntry,
} from './useAgentOnboardingFirstEntry';

const mocks = vi.hoisted(() => ({
  hasFirstEntry: false,
  hasFirstEntryFailed: false,
  pendingAt: undefined as number | undefined,
}));

vi.mock('@tloncorp/shared/db', () => ({
  agentGroupOnboardingLocks: { setValue: vi.fn(async () => undefined) },
  getChanPosts: vi.fn(async () => []),
}));
vi.mock('@tloncorp/shared/store', () => ({
  syncSince: vi.fn(async () => undefined),
}));
vi.mock('./agentOnboardingFirstEntry', () => ({
  hasAgentOnboardingFirstEntry: () => mocks.hasFirstEntry,
  hasAgentOnboardingFirstEntryFailed: () => mocks.hasFirstEntryFailed,
  getAgentOnboardingFirstEntryPendingAt: () => mocks.pendingAt,
}));

type HookProps = Parameters<typeof useAgentOnboardingFirstEntry>[0];

const LABEL_NODE = 'Label';
function Harness(props: HookProps) {
  const label = useAgentOnboardingFirstEntry(props);
  return React.createElement(LABEL_NODE, { label });
}

function labelOf(renderer: ReactTestRenderer): string | undefined {
  return renderer.root.find((node) => (node.type as unknown) === LABEL_NODE)
    .props.label;
}

// Polling is off (`isFocused: false`) so the rotation is the only timer here.
const waitingProps = (): HookProps => ({
  agentShipId: '~bot',
  awaitingFirstEntry: true,
  channelId: 'chat/~zod/setup',
  groupId: '~zod/home',
  isFocused: false,
  posts: [],
  provisionId: 'provision-1',
  provisionAcknowledgedAt: Date.now(),
});

const STATUS_INTERVAL_MS = 5_000;
const [firstStatus, secondStatus] = AGENT_ONBOARDING_FIRST_ENTRY_STATUSES;

function render(props: HookProps) {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(<Harness {...props} />);
  });
  return renderer!;
}

function update(renderer: ReactTestRenderer, props: HookProps) {
  act(() => {
    renderer.update(<Harness {...props} />);
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useAgentOnboardingFirstEntry', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.hasFirstEntry = false;
    mocks.hasFirstEntryFailed = false;
    mocks.pendingAt = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing until the bot has taken on the first entry', () => {
    const renderer = render({
      ...waitingProps(),
      awaitingFirstEntry: false,
      provisionAcknowledgedAt: undefined,
    });
    expect(labelOf(renderer)).toBeUndefined();
    act(() => renderer.unmount());
  });

  it('opens with the first status', () => {
    const renderer = render(waitingProps());
    expect(labelOf(renderer)).toBe(firstStatus);
    act(() => renderer.unmount());
  });

  it('rotates through every status on a five-second timer, then loops', () => {
    const renderer = render(waitingProps());

    advance(STATUS_INTERVAL_MS - 1);
    expect(labelOf(renderer)).toBe(firstStatus);
    advance(1);
    expect(labelOf(renderer)).toBe(secondStatus);

    for (const status of AGENT_ONBOARDING_FIRST_ENTRY_STATUSES.slice(2)) {
      advance(STATUS_INTERVAL_MS);
      expect(labelOf(renderer)).toBe(status);
    }

    advance(STATUS_INTERVAL_MS);
    expect(labelOf(renderer)).toBe(firstStatus);
    act(() => renderer.unmount());
  });

  it('stops rotating once the first entry lands', () => {
    const props = waitingProps();
    const renderer = render(props);
    advance(STATUS_INTERVAL_MS);
    expect(labelOf(renderer)).toBe(secondStatus);

    mocks.hasFirstEntry = true;
    update(renderer, { ...props, posts: [] });
    expect(labelOf(renderer)).toBeUndefined();

    advance(STATUS_INTERVAL_MS * 3);
    expect(labelOf(renderer)).toBeUndefined();
    act(() => renderer.unmount());
  });

  it('restarts from the first status when the wait begins again', () => {
    const props = waitingProps();
    const renderer = render(props);
    advance(STATUS_INTERVAL_MS * 2);
    expect(labelOf(renderer)).toBe(AGENT_ONBOARDING_FIRST_ENTRY_STATUSES[2]);

    update(renderer, { ...props, awaitingFirstEntry: false });
    expect(labelOf(renderer)).toBeUndefined();

    update(renderer, props);
    expect(labelOf(renderer)).toBe(firstStatus);
    act(() => renderer.unmount());
  });

  it('gives up with the indicator after five minutes', () => {
    const renderer = render(waitingProps());
    advance(5 * 60_000);
    expect(labelOf(renderer)).toBeUndefined();
    act(() => renderer.unmount());
  });
});
