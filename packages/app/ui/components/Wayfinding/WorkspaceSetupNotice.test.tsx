import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import WayfindingNotice from './Notices';

vi.mock('@tloncorp/api', () => ({ getCurrentUserIsHosted: () => false }));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/store', () => ({
  useWorkspaceSetupProgress: () => ({
    status: 'idle',
    groupId: null,
    steps: [],
  }),
}));
vi.mock('../AgentTaskRows', () => ({ AgentTaskRows: 'AgentTaskRows' }));
vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({
  Circle: 'Circle',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  isWeb: false,
  styled: () => 'Styled',
}));
vi.mock('../InviteFriendsToTlonButton', () => ({
  InviteFriendsToTlonButton: 'InviteFriendsToTlonButton',
}));

const CHANNEL = { id: 'chat/~host/meals-1234', type: 'chat' } as never;

function findByTestID(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findAll((node) => node.props?.testID === testID, {
    deep: true,
  })[0];
}

function renderNotice(
  overrides: {
    setupComplete?: boolean;
    onPressInvite?: () => void;
  } = {}
) {
  const props = {
    channel: CHANNEL,
    setupComplete: false,
    onPressInvite: vi.fn(),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<WayfindingNotice.WorkspaceSetup {...props} />);
  });
  return { renderer, props };
}

/** Every string the notice rendered, flattened. */
function textOf(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

describe('WorkspaceSetup notice', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  // AC #5. The user can land here in under a second, well before the agent has
  // said anything — so the empty room needs an explanation, not a welcome.
  it('says setup is in progress while it is', () => {
    const text = textOf(renderNotice().renderer);

    expect(text).toMatch(/Setting up your workspace/);
    expect(text).toMatch(/don’t need to do anything/);
  });

  // AC #2. Nothing to do about the wait, so the offered action is the one that
  // makes the workspace worth having.
  it('offers the invite while setup is pending', () => {
    const { renderer, props } = renderNotice();
    const invite = findByTestID(renderer, 'WorkspaceSetupInvite');

    act(() => invite.props.onPress());
    expect(props.onPressInvite).toHaveBeenCalledTimes(1);
  });

  it('omits the invite when the caller offers none', () => {
    const { renderer } = renderNotice({ onPressInvite: undefined });
    expect(findByTestID(renderer, 'WorkspaceSetupInvite')).toBeUndefined();
  });

  // Setup done but still nothing here is a different situation: a wait that
  // resolved into nothing. Saying so beats an encouraging message that never
  // comes true.
  it('changes what it says once setup has completed', () => {
    const text = textOf(renderNotice({ setupComplete: true }).renderer);

    expect(text).toMatch(/Nothing here yet/);
    expect(text).not.toMatch(/Setting up your workspace/);
  });

  it('drops the invite prompt once setup has completed', () => {
    const { renderer } = renderNotice({ setupComplete: true });
    expect(findByTestID(renderer, 'WorkspaceSetupInvite')).toBeUndefined();
  });
});
