import type { ReactNode } from 'react';
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
  useToast: () => mocks.toast,
}));
vi.mock('tamagui', () => ({ View: 'View', YStack: 'YStack' }));
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
vi.mock('../../ui/components/ExpandableContent', async () => {
  const { createElement, useState } = await import('react');
  let mounts = 0;
  return {
    // Numbers each mount, so a test can tell a remount from a re-render.
    ExpandableContent: ({ children }: { children: ReactNode }) => {
      const [mount] = useState(() => ++mounts);
      return createElement('ExpandableContent', { mount }, children);
    },
  };
});
vi.mock('../../ui/components/NotebookPost/NotebookPost', () => ({
  NotebookContentRenderer: 'NotebookContentRenderer',
}));
vi.mock('../../ui/components/SettingsList', () => ({
  useSettingsListColors: () => ({ row: 'white' }),
  useSettingsListHeaderColor: () => 'white',
  useSettingsListSurfaces: () => ({ page: 'white' }),
}));
vi.mock('./bot/BotSettingsUI', async () => {
  const { createElement } = await import('react');
  return {
    // Keeps the subtitle, which is where a read-only file says who keeps it.
    BotSettingsSection: ({
      children,
      subtitle,
    }: {
      children?: ReactNode;
      subtitle?: string;
    }) => createElement('BotSettingsSection', { subtitle }, children),
  };
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
    {
      name: 'MEMORY.md',
      text: '<!-- idempotency-marker:tlon-runtime:v4 -->\n# MEMORY.md\n<!-- /idempotency-marker -->\n\nPrefers metric units.\n',
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
      (node.type as unknown) === 'ConfirmDialog' &&
      node.props.confirmText === confirmText
  );
const expander = (tree: ReactTestRenderer) =>
  tree.root.find((node) => (node.type as unknown) === 'ExpandableContent');
const editorSheets = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => (node.type as unknown) === 'EditorSheet');

function press(tree: ReactTestRenderer, testID: string) {
  act(() => {
    byTestID(tree, testID)[0].props.onPress();
  });
}

const sectionSubtitle = (tree: ReactTestRenderer) =>
  tree.root.find((node) => (node.type as unknown) === 'BotSettingsSection')
    .props.subtitle;

describe('BotPromptFileScreen', () => {
  it('shows a file Tlon maintains without any way to edit it', async () => {
    const tree = await render('TOOLS.md');
    expect(byTestID(tree, 'BotPromptFileContents')).toHaveLength(1);
    expect(byTestID(tree, 'BotPromptFileEdit')).toHaveLength(0);
    expect(byTestID(tree, 'BotPromptFileReset')).toHaveLength(0);
    expect(sectionSubtitle(tree)).toContain('Tlon keeps this file');
  });

  it("shows the bot's memory, kept by the bot, without any way to edit it", async () => {
    const tree = await render('MEMORY.md');
    expect(
      byTestID(tree, 'BotPromptFileContents')[0].find(
        (node) => (node.type as unknown) === 'NotebookContentRenderer'
      ).props.content
    ).toEqual(['# MEMORY.md\n\nPrefers metric units.']);
    expect(byTestID(tree, 'BotPromptFileEdit')).toHaveLength(0);
    expect(sectionSubtitle(tree)).toContain('Your bot keeps this file');
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

  it("won't reset a file that lost Tlon's block while the dialog was up", async () => {
    mocks.prompts = [{ name: 'SOUL.md', text: `Call me Captain.\n${block}\n` }];
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileReset');
    // Rewritten whole from another device before the reset was confirmed.
    mocks.prompts = [{ name: 'SOUL.md', text: 'My own soul.\n' }];
    await act(async () => {
      tree.update(
        <BotPromptFileScreen
          navigation={{ goBack: vi.fn() } as never}
          route={{ params: { name: 'SOUL.md' } } as never}
        />
      );
    });

    await act(async () => {
      await dialog(tree, 'Reset').props.onConfirm();
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('confirms a reset only for the file it was opened for', async () => {
    mocks.prompts = [
      { name: 'SOUL.md', text: `Call me Captain.\n${block}\n` },
      { name: 'IDENTITY.md', text: `Name: Ahab.\n${block}\n` },
    ];
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileReset');
    // A native alert keeps the callback it was opened with.
    const confirmOpened = dialog(tree, 'Reset').props.onConfirm;

    // A deep link reuses the screen for another file while the alert is up.
    await act(async () => {
      tree.update(
        <BotPromptFileScreen
          navigation={{ goBack: vi.fn() } as never}
          route={{ params: { name: 'IDENTITY.md' } } as never}
        />
      );
    });
    await act(async () => {
      await confirmOpened();
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('drops an open editor when the screen moves to another file', async () => {
    mocks.warningSeen = true;
    mocks.prompts = [
      { name: 'SOUL.md', text: `${block}\n` },
      { name: 'IDENTITY.md', text: `${block}\n` },
    ];
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileEdit');
    expect(editorSheets(tree)).toHaveLength(1);

    await act(async () => {
      tree.update(
        <BotPromptFileScreen
          navigation={{ goBack: vi.fn() } as never}
          route={{ params: { name: 'IDENTITY.md' } } as never}
        />
      );
    });
    expect(editorSheets(tree)).toHaveLength(0);
  });

  it('offers no reset when nothing has been added', async () => {
    const tree = await render('SOUL.md');
    expect(byTestID(tree, 'BotPromptFileEdit')).toHaveLength(1);
    expect(byTestID(tree, 'BotPromptFileReset')).toHaveLength(0);
  });

  it('shows no additions block until something has been added', async () => {
    const tree = await render('SOUL.md');
    expect(byTestID(tree, 'BotPromptFileAdditions')).toHaveLength(0);
    expect(byTestID(tree, 'BotPromptFileDefault')).toHaveLength(1);
  });

  it("puts Tlon's default, collapsible, above the additions", async () => {
    mocks.prompts = [{ name: 'SOUL.md', text: `Call me Captain.\n${block}\n` }];
    const tree = await render('SOUL.md');
    const order = tree.root
      .findAll(
        (node) =>
          typeof node.type === 'string' &&
          ['BotPromptFileDefault', 'BotPromptFileAdditions'].includes(
            node.props.testID
          )
      )
      .map((node) => node.props.testID);
    expect(order).toEqual(['BotPromptFileDefault', 'BotPromptFileAdditions']);
    expect(
      expander(tree).findAll(
        (node) => node.props.testID === 'BotPromptFileDefault'
      )
    ).not.toHaveLength(0);
  });

  it('shows no additions block for whitespace alone', async () => {
    mocks.prompts = [{ name: 'SOUL.md', text: `   \n${block}\n` }];
    const tree = await render('SOUL.md');
    expect(byTestID(tree, 'BotPromptFileAdditions')).toHaveLength(0);
    expect(byTestID(tree, 'BotPromptFileReset')).toHaveLength(0);
  });

  it("collapses Tlon's default again when the screen moves to another file", async () => {
    mocks.prompts = [
      { name: 'SOUL.md', text: `${block}\n` },
      { name: 'IDENTITY.md', text: `${block}\n` },
    ];
    const tree = await render('SOUL.md');
    const before = expander(tree).props.mount;

    await act(async () => {
      tree.update(
        <BotPromptFileScreen
          navigation={{ goBack: vi.fn() } as never}
          route={{ params: { name: 'IDENTITY.md' } } as never}
        />
      );
    });
    expect(expander(tree).props.mount).not.toBe(before);
  });
});
