import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { BotPromptFileScreen } from './BotPromptFileScreen';

const mocks = vi.hoisted(() => ({
  prompts: [] as { name: string; text: string }[],
  warningSeen: false,
  hosted: true,
  restartingShip: null as string | null,
  setWarningSeen: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
  restart: vi.fn(),
  invalidate: vi.fn(),
  setQueryData: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidate,
    setQueryData: mocks.setQueryData,
  }),
}));
vi.mock('@tloncorp/api', () => ({
  getBotUserIdForUser: () => '~bot',
  getCurrentUserIsHosted: () => mocks.hosted,
}));
vi.mock('@tloncorp/api/lib/urbit', () => ({
  desig: (ship: string) => ship.replace(/^~/, ''),
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
vi.mock('./bot/restartHostedBot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bot/restartHostedBot')>()),
  restartHostedBot: mocks.restart,
  useHostedBotRestarting: (ship: string | null) =>
    ship !== null && ship === mocks.restartingShip,
}));

setupReactTestEnvironment();

const block =
  '<!-- idempotency-marker:tlon-runtime:v10 -->\n\n## Who You Are\n<!-- /idempotency-marker -->';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.warningSeen = false;
  mocks.hosted = true;
  mocks.restartingShip = null;
  mocks.save.mockResolvedValue(undefined);
  mocks.restart.mockResolvedValue(true);
  mocks.prompts = [
    { name: 'SOUL.md', text: `${block}\n` },
    {
      name: 'TOOLS.md',
      text: '<!-- idempotency-marker:tlon-tools:v25 -->\n\n## When To Use What\n<!-- /idempotency-marker -->\n',
    },
  ];
});

async function render(name: string, botShip?: string) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BotPromptFileScreen
        navigation={{ goBack: vi.fn() } as never}
        route={{ params: { name, botShip } } as never}
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
const editorSheets = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => (node.type as unknown) === 'EditorSheet');

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

  it('restarts the hosted bot after a save so it runs on the new file', async () => {
    mocks.warningSeen = true;
    let finish!: (running: boolean) => void;
    mocks.restart.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      })
    );
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileEdit');
    expect(editorSheets(tree)[0].props.restartsBotOnSave).toBe(true);

    await act(async () => {
      editorSheets(tree)[0].props.onSaved(
        'SOUL.md',
        `Call me Admiral.\n${block}\n`
      );
    });
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.restart).toHaveBeenCalledWith('owner');
    // Readiness is marked off for the outage, which also starts bot
    // settings' own polling until the bot is back.
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ['tlonbot', 'ready', 'owner'],
      false
    );
    expect(mocks.invalidate).not.toHaveBeenCalled();

    await act(async () => {
      finish(true);
    });
    expect(mocks.invalidate).toHaveBeenCalledWith({
      queryKey: ['tlonbot', 'ready', 'owner'],
    });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Your bot restarted with the change.',
      })
    );
  });

  it('shows a restart in progress only for the bot being restarted', async () => {
    mocks.restartingShip = 'owner';
    mocks.prompts = [{ name: 'SOUL.md', text: `Call me Captain.\n${block}\n` }];
    const tree = await render('SOUL.md');
    expect(byTestID(tree, 'BotPromptFileRestarting')).toHaveLength(1);
    expect(byTestID(tree, 'BotPromptFileEdit')[0].props.disabled).toBe(true);
    expect(byTestID(tree, 'BotPromptFileReset')[0].props.disabled).toBe(true);

    // The desktop drawer reuses this screen for another bot's file.
    await act(async () => {
      tree.update(
        <BotPromptFileScreen
          navigation={{ goBack: vi.fn() } as never}
          route={{ params: { name: 'SOUL.md', botShip: '~other' } } as never}
        />
      );
    });
    expect(byTestID(tree, 'BotPromptFileRestarting')).toHaveLength(0);
    expect(byTestID(tree, 'BotPromptFileEdit')[0].props.disabled).toBe(false);

    mocks.restartingShip = null;
    await act(async () => {
      tree.update(
        <BotPromptFileScreen
          navigation={{ goBack: vi.fn() } as never}
          route={{ params: { name: 'SOUL.md' } } as never}
        />
      );
    });
    expect(byTestID(tree, 'BotPromptFileRestarting')).toHaveLength(0);
    expect(byTestID(tree, 'BotPromptFileEdit')[0].props.disabled).toBe(false);
  });

  it('keeps the save when the bot cannot be restarted', async () => {
    mocks.warningSeen = true;
    mocks.restart.mockRejectedValue(new Error('403'));
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileEdit');
    await act(async () => {
      editorSheets(tree)[0].props.onSaved(
        'SOUL.md',
        `Call me Admiral.\n${block}\n`
      );
    });
    expect(byTestID(tree, 'BotPromptFileRestarting')).toHaveLength(0);
    expect(byTestID(tree, 'BotPromptFileEdit')[0].props.disabled).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("couldn't restart"),
      })
    );
  });

  it('says when the restart could not be confirmed', async () => {
    mocks.warningSeen = true;
    mocks.restart.mockResolvedValue(false);
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileEdit');
    await act(async () => {
      editorSheets(tree)[0].props.onSaved('SOUL.md', `${block}\n`);
    });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("couldn't confirm"),
      })
    );
  });

  it('restarts after a reset too', async () => {
    mocks.prompts = [{ name: 'SOUL.md', text: `Call me Captain.\n${block}\n` }];
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileReset');
    await act(async () => {
      await dialog(tree, 'Reset').props.onConfirm();
    });
    expect(mocks.restart).toHaveBeenCalledWith('owner');
  });

  it("leaves a bot Hosting doesn't run alone", async () => {
    mocks.warningSeen = true;
    const tree = await render('SOUL.md', '~other');
    press(tree, 'BotPromptFileEdit');
    expect(editorSheets(tree)[0].props.restartsBotOnSave).toBe(false);

    await act(async () => {
      editorSheets(tree)[0].props.onSaved('SOUL.md', `${block}\n`);
    });
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.restart).not.toHaveBeenCalled();
    expect(byTestID(tree, 'BotPromptFileRestarting')).toHaveLength(0);
  });

  it('does not reach for Hosting from a self-hosted ship', async () => {
    mocks.hosted = false;
    mocks.warningSeen = true;
    const tree = await render('SOUL.md');
    press(tree, 'BotPromptFileEdit');
    expect(editorSheets(tree)[0].props.restartsBotOnSave).toBe(false);

    await act(async () => {
      editorSheets(tree)[0].props.onSaved('SOUL.md', `${block}\n`);
    });
    expect(mocks.restart).not.toHaveBeenCalled();
  });
});
