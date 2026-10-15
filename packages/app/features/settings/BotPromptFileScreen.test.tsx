import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { BotPromptFileScreen } from './BotPromptFileScreen';

const mocks = vi.hoisted(() => ({
  prompts: [] as { name: string; text: string }[],
  warningSeen: false,
  setWarningSeen: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  getBotUserIdForUser: () => '~bot',
}));
vi.mock('@tloncorp/shared', () => ({
  markdownToStory: (markdown: string) => markdown,
  convertContent: (story: string) => [story],
}));
vi.mock('@tloncorp/shared/db', () => ({
  botPromptEditWarningSeen: {
    useValue: () => mocks.warningSeen,
    setValue: mocks.setWarningSeen,
  },
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  ConfirmDialog: 'ConfirmDialog',
  LoadingSpinner: 'LoadingSpinner',
  Text: 'Text',
  useIsWindowNarrow: () => true,
  useToast: () => mocks.toast,
}));
vi.mock('tamagui', () => ({ View: 'View', YStack: 'YStack' }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUserId: () => '~owner',
}));
vi.mock('../../ui', async () => {
  const { Passthrough } = await import('../../test/sheetTestUtils');
  return {
    ScreenHeader: 'ScreenHeader',
    SettingsContentScrollView: Passthrough,
  };
});
vi.mock('../../ui/components/BotSystemPrompts', () => ({
  BotSystemPromptEditorSheet: 'EditorSheet',
  useBotSystemPrompts: () => ({ data: mocks.prompts, isPending: false }),
  useDeskSupportsPrompts: () => null,
  useRefreshStewardPrompts: () => mocks.refresh,
  useStewardPromptSave: () => mocks.save,
  useStewardPromptsFeed: () => {},
}));
vi.mock('../../ui/components/NotebookPost/NotebookPost', () => ({
  NotebookContentRenderer: 'NotebookContentRenderer',
}));
vi.mock('../../ui/components/SettingsList', () => ({
  useSettingsListHeaderColor: () => 'white',
  useSettingsListSurfaces: () => ({ page: 'white' }),
}));
vi.mock('./bot/BotSettingsUI', async () => {
  const { Passthrough } = await import('../../test/sheetTestUtils');
  return { BotSettingsSection: Passthrough };
});

setupReactTestEnvironment();

const block =
  '<!-- idempotency-marker:tlon-runtime:v10 -->\n\n## Who You Are\n<!-- /idempotency-marker -->';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.warningSeen = false;
  mocks.save.mockResolvedValue(undefined);
  mocks.prompts = [
    { name: 'SOUL.md', text: `${block}\n` },
    {
      name: 'TOOLS.md',
      text: '<!-- idempotency-marker:tlon-tools:v25 -->\n\n## When To Use What\n<!-- /idempotency-marker -->\n',
    },
  ];
});

async function render(name: string) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BotPromptFileScreen
        navigation={{ goBack: vi.fn() } as never}
        route={{ params: { name } } as never}
      />
    );
  });
  return tree;
}

const byTestID = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll(
    (node) => typeof node.type === 'string' && node.props.testID === testID
  );
const dialog = (tree: ReactTestRenderer, confirmText: string) =>
  tree.root.find(
    (node) =>
      node.type === 'ConfirmDialog' && node.props.confirmText === confirmText
  );
const editorSheets = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => node.type === 'EditorSheet');

function press(tree: ReactTestRenderer, testID: string) {
  act(() => {
    byTestID(tree, testID)[0].props.onPress();
  });
}

describe('BotPromptFileScreen', () => {
  it('shows a file Tlon maintains without any way to edit it', async () => {
    const tree = await render('TOOLS.md');
    expect(byTestID(tree, 'BotPromptFileContents')).toHaveLength(1);
    expect(byTestID(tree, 'BotPromptFileEdit')).toHaveLength(0);
    expect(byTestID(tree, 'BotPromptFileReset')).toHaveLength(0);
  });

  it('warns before the first edit, then opens the additions editor', async () => {
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileEdit');
    expect(dialog(tree, 'Continue').props.open).toBe(true);
    expect(editorSheets(tree)).toHaveLength(0);

    act(() => {
      dialog(tree, 'Continue').props.onConfirm();
    });
    expect(mocks.setWarningSeen).toHaveBeenCalledWith(true);
    expect(editorSheets(tree)[0].props).toMatchObject({
      scope: 'additions',
      prompt: { name: 'SOUL.md' },
    });
  });

  it('skips the warning once it has been read', async () => {
    mocks.warningSeen = true;
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileEdit');
    expect(dialog(tree, 'Continue').props.open).toBe(false);
    expect(editorSheets(tree)).toHaveLength(1);
  });

  it("resets by removing the additions and keeping Tlon's block", async () => {
    mocks.prompts = [{ name: 'SOUL.md', text: `Call me Captain.\n${block}\n` }];
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileReset');
    expect(dialog(tree, 'Reset').props.open).toBe(true);

    await act(async () => {
      await dialog(tree, 'Reset').props.onConfirm();
    });
    expect(mocks.save).toHaveBeenCalledWith(`${block}\n`);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('offers no reset when nothing has been added', async () => {
    const tree = await render('SOUL.md');
    expect(byTestID(tree, 'BotPromptFileEdit')).toHaveLength(1);
    expect(byTestID(tree, 'BotPromptFileReset')).toHaveLength(0);
  });
});
