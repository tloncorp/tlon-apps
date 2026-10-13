import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  platform: 'ios',
  glass: true,
  floating: false,
  send: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('tamagui', () => ({
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  getVariableValue: (value: unknown) => value,
  useTheme: () => ({ background: '#fff', secondaryBackground: '#eee' }),
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  FloatingActionButton: 'FloatingActionButton',
  Icon: 'Icon',
}));
vi.mock('../../contexts/attachment', () => ({
  useAttachmentContext: () => ({ canUpload: false }),
}));
vi.mock('../../contexts/scroll', () => ({
  useConversationScrollToBottomControl: () => null,
}));
vi.mock('../Channel/ConversationLayout', () => ({
  useConversationComposerLayout: () => ({ floating: state.floating }),
}));
vi.mock('../GlassSurface', () => ({
  supportsLiquidGlass: () => state.glass,
  GlassSurface: 'GlassSurface',
  GlassSurfaceGroup: 'GlassSurfaceGroup',
}));
vi.mock('../Wayfinding/Notices', () => ({ default: {} }));
vi.mock('../conversationScrollChrome', async () => ({
  ...(await import('../conversationInsets')),
  ConversationScrollToBottomButton: 'ScrollToBottomButton',
}));
vi.mock('./AttachmentButton', () => ({ default: 'AttachmentButton' }));
vi.mock('./InputMentionPopup', () => ({ default: () => null }));
vi.mock('./InputSlashCommandPopup', () => ({ default: () => null }));

let MessageInputContainer: typeof import('./MessageInputBase').MessageInputContainer;
let renderer: ReactTestRenderer;
let inputMounts: number;

function Draft() {
  const [text, setText] = React.useState('Keep this draft');
  React.useEffect(() => {
    inputMounts += 1;
  }, []);
  return (
    <input value={text} onChange={(event) => setText(event.target.value)} />
  );
}

function render(floatingActionButton = false) {
  return (
    <MessageInputContainer
      onPressSend={state.send}
      setShouldBlur={() => {}}
      containerHeight={48}
      sendError={false}
      mentionOptions={[]}
      onSelectMention={() => {}}
      floatingActionButton={floatingActionButton}
    >
      <Draft />
    </MessageInputContainer>
  );
}

beforeEach(() => {
  state.floating = false;
  state.send.mockClear();
  inputMounts = 0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});

afterEach(() => {
  act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

describe.each([
  ['ios', true],
  ['ios', false],
  ['android', false],
  ['web', false],
] as const)('%s, Liquid Glass %s', (platform, glass) => {
  beforeEach(async () => {
    state.platform = platform;
    state.glass = glass;
    vi.resetModules();
    ({ MessageInputContainer } = await import('./MessageInputBase'));
  });

  it('keeps the send control and draft mounted when scrolling away from and back to the latest message', () => {
    act(() => {
      renderer = create(render());
    });
    const sendButton = renderer.root.findByType('Button' as never);
    const draft = renderer.root.findByType('input');
    for (const floating of [false, true, false]) {
      state.floating = floating;
      act(() => renderer.update(render()));
      expect(renderer.root.findByType('Button' as never)).toBe(sendButton);
      expect(renderer.root.findByType('input')).toBe(draft);
      expect(draft.props.value).toBe('Keep this draft');
      expect(inputMounts).toBe(1);
      if (glass) {
        const surfaces = renderer.root.findAllByType('GlassSurface' as never);
        const body = surfaces.find((node) => node.props.style.flex === 1)!;
        const action = surfaces.find((node) => node.props.style.width === 48)!;
        expect(body.findAllByType('Button' as never)).toHaveLength(0);
        expect(action.findByType('Button' as never)).toBe(sendButton);
      } else {
        expect(
          renderer.root.findAllByType('GlassSurface' as never)
        ).toHaveLength(0);
      }
    }
    act(() => sendButton.props.onPress());
    expect(state.send).toHaveBeenCalledOnce();
  });

  it('preserves the standalone floating action button used by other composers', () => {
    act(() => {
      renderer = create(render(true));
    });
    expect(renderer.root.findAllByType('Button' as never)).toHaveLength(0);
    const button = renderer.root.findByType('FloatingActionButton' as never);
    act(() => button.props.onPress());
    expect(state.send).toHaveBeenCalledOnce();
  });
});
