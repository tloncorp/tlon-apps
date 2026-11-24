import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type OpenAIAuthState } from '../../features/settings/bot/openAiSubscription';
import { setupReactTestEnvironment } from '../../test/sheetTestUtils';
import { LLMSubscriptionAuthView } from './LLMSubscriptionAuthView';

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  toast: vi.fn(),
  trackError: vi.fn(),
}));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: mocks.trackError }),
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  LoadingSpinner: 'LoadingSpinner',
  Pressable: 'Pressable',
  Text: 'Text',
  useCopy: () => ({ doCopy: mocks.copy, didCopy: false }),
  useToast: () => mocks.toast,
}));
vi.mock('tamagui', () => ({ View: 'View', YStack: 'YStack' }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: 'ScrollView',
}));
vi.mock('./Form', () => ({ TextInput: 'TextInput' }));
vi.mock('./ScreenHeader', () => ({
  ScreenHeader: { BackButton: 'BackButton' },
}));

setupReactTestEnvironment();

const flow = {
  id: 'flow-1',
  provider: 'openai' as const,
  status: 'awaiting_browser' as const,
  expiresAt: 60_000,
  userCode: 'ABCD-1234',
  verificationUrl: 'https://auth.openai.com/codex/device',
};

describe('ChatGPT subscription sign-in', () => {
  let renderer: ReactTestRenderer;
  const openBrowser = vi.fn(async () => {});
  const onContinue = vi.fn();

  async function render(state: OpenAIAuthState = { phase: 'active', flow }) {
    await act(async () => {
      renderer = create(
        <LLMSubscriptionAuthView
          state={state}
          onStart={vi.fn()}
          onOpenBrowser={openBrowser}
          onContinue={onContinue}
          onSubmitToken={async () => false}
          onRetry={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.copy.mockResolvedValue(true);
  });
  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('copies the code and opens sign-in in the same tap and ignores a second tap', async () => {
    let finishCopy: (copied: boolean) => void = () => {};
    mocks.copy.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishCopy = resolve;
      })
    );
    await render();
    const button = renderer.root.findByProps({ label: 'Copy and continue' });
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = button.props.onPress();
    });
    expect(mocks.copy).toHaveBeenCalledTimes(1);
    expect(openBrowser).toHaveBeenCalledTimes(1);
    expect(mocks.copy.mock.invocationCallOrder[0]).toBeLessThan(
      openBrowser.mock.invocationCallOrder[0]
    );
    await act(async () => {
      await button.props.onPress();
      finishCopy(true);
      await pending;
    });
    expect(mocks.copy).toHaveBeenCalledTimes(1);
    expect(openBrowser).toHaveBeenCalledTimes(1);
  });

  it.each(['refused', 'rejected'])(
    'still opens sign-in and reports a %s clipboard write',
    async (failure) => {
      if (failure === 'refused') mocks.copy.mockResolvedValue(false);
      else mocks.copy.mockRejectedValue(new Error('Clipboard unavailable'));
      await render();
      await act(async () => {
        await renderer.root
          .findByProps({ label: 'Copy and continue' })
          .props.onPress();
      });
      expect(openBrowser).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(renderer.toJSON())).toContain(
        'Could not copy the code. Please try again.'
      );
      expect(mocks.trackError).toHaveBeenCalledTimes(1);
    }
  );

  it('shows the confirmed connection until the user continues', async () => {
    await render({ phase: 'connected', flow: { ...flow, status: 'complete' } });
    expect(JSON.stringify(renderer.toJSON())).toContain('ChatGPT connected');
    expect(JSON.stringify(renderer.toJSON())).not.toContain(flow.userCode);
    expect(onContinue).not.toHaveBeenCalled();
    act(() => {
      renderer.root.findByProps({ label: 'Continue' }).props.onPress();
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
