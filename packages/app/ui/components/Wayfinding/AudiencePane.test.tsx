import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AUDIENCE_DIFFERENTIATION, AudiencePane } from './AudiencePane';

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Pressable: 'Pressable',
  Text: 'Text',
  useCopy: () => ({ doCopy: vi.fn(), didCopy: false }),
}));

vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  isWeb: false,
  styled: () => 'Styled',
}));

vi.mock('./splashPrimitives', () => ({
  SplashTitle: 'SplashTitle',
  SplashParagraph: 'SplashParagraph',
}));

// The container half of the module reaches for the db, the store and the invite
// service. Only the pane is under test here; the container's behaviour is
// covered by the landing tests.
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: vi.fn(), trackEvent: vi.fn() }),
}));
vi.mock('@tloncorp/shared/db', () => ({
  workspaceProvisioning: { useValue: () => null },
  workspaceLanding: { setValue: vi.fn() },
}));
vi.mock('@tloncorp/shared/logic', () => ({
  readWorkspaceDescriptor: () => null,
  workspaceConversation: () => null,
}));
vi.mock('@tloncorp/shared/store', () => ({ useGroup: () => ({ data: null }) }));
vi.mock('./useGroupInviteLink', () => ({
  useGroupInviteLink: () => ({ inviteUrl: null, state: 'unavailable' }),
}));

function findByTestID(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findAll((node) => node.props?.testID === testID, {
    deep: true,
  })[0];
}

function renderPane(
  overrides: Partial<React.ComponentProps<typeof AudiencePane>> = {}
) {
  const props = {
    inviteState: 'ready' as const,
    onInvitePress: vi.fn(),
    onContinueAlone: vi.fn(),
    onFindPeoplePress: vi.fn(),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<AudiencePane {...props} />);
  });
  return { renderer, props };
}

describe('AudiencePane', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  // AC #1
  it('offers an invite and a continue-alone path, and both advance', () => {
    const { renderer, props } = renderPane();

    act(() => {
      findByTestID(renderer, 'audience-invite').props.onPress();
    });
    expect(props.onInvitePress).toHaveBeenCalledTimes(1);

    act(() => {
      findByTestID(renderer, 'audience-continue-alone').props.onPress();
    });
    expect(props.onContinueAlone).toHaveBeenCalledTimes(1);
  });

  // AC #2. Asserted against the exported copy rather than inline strings, so a
  // reword updates one place and the criterion stays pinned to the meaning.
  it('carries all three differentiation points', () => {
    const { renderer } = renderPane();

    expect(
      findByTestID(renderer, 'audience-private-access').props.children
    ).toBe(AUDIENCE_DIFFERENTIATION.privateAccess);
    expect(
      findByTestID(renderer, 'audience-private-store').props.children
    ).toBe(AUDIENCE_DIFFERENTIATION.privateStore);
    expect(
      findByTestID(renderer, 'audience-model-independence').props.children
    ).toBe(AUDIENCE_DIFFERENTIATION.modelIndependence);
  });

  // The three points have to say the three things, not merely exist. A copy
  // edit that drops the substance should fail.
  it('says private access, private storage and model independence', () => {
    expect(AUDIENCE_DIFFERENTIATION.privateAccess).toMatch(
      /only the people you invite/i
    );
    expect(AUDIENCE_DIFFERENTIATION.privateStore).toMatch(
      /your own data store/i
    );
    expect(AUDIENCE_DIFFERENTIATION.modelIndependence).toMatch(
      /does not erase/i
    );
  });

  // AC #4. Continuing alone is a plain text link and always enabled — nothing
  // about it is conditional on the invite having worked.
  it('keeps continue-alone available when no invite link exists', () => {
    const { renderer, props } = renderPane({ inviteState: 'unavailable' });

    const skip = findByTestID(renderer, 'audience-continue-alone');
    expect(skip.props.disabled).toBeFalsy();
    act(() => skip.props.onPress());
    expect(props.onContinueAlone).toHaveBeenCalledTimes(1);
  });

  // 'unavailable' still leaves the primary pressable: it falls through to the
  // address book rather than dead-ending on a disabled button.
  it('only disables the invite button while the link is loading', () => {
    expect(
      findByTestID(
        renderPane({ inviteState: 'loading' }).renderer,
        'audience-invite'
      ).props.disabled
    ).toBe(true);
    expect(
      findByTestID(
        renderPane({ inviteState: 'unavailable' }).renderer,
        'audience-invite'
      ).props.disabled
    ).toBe(false);
  });

  it('names the loading state rather than showing a bare button', () => {
    expect(
      findByTestID(
        renderPane({ inviteState: 'loading' }).renderer,
        'audience-invite'
      ).props.label
    ).toMatch(/preparing/i);
    expect(
      findByTestID(
        renderPane({ didCopyInvite: true }).renderer,
        'audience-invite'
      ).props.label
    ).toMatch(/copied/i);
  });

  it('routes into the address book when offered, and omits it when not', () => {
    const { renderer, props } = renderPane();
    act(() => findByTestID(renderer, 'audience-find-people').props.onPress());
    expect(props.onFindPeoplePress).toHaveBeenCalledTimes(1);

    const without = renderPane({ onFindPeoplePress: undefined });
    expect(
      findByTestID(without.renderer, 'audience-find-people')
    ).toBeUndefined();
  });

  // While completing, every exit is disabled: a second tap during the handoff
  // would race the landing record against the navigation.
  it('disables every action while completing', () => {
    const { renderer } = renderPane({ isCompleting: true });

    for (const id of [
      'audience-invite',
      'audience-find-people',
      'audience-continue-alone',
    ]) {
      expect(findByTestID(renderer, id).props.disabled, id).toBe(true);
    }
  });
});
