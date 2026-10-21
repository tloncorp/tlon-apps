import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { BotPromptFilesScreen } from './BotPromptFilesScreen';

const mocks = vi.hoisted(() => ({
  query: {} as {
    data?: { name: string; text: string }[];
    isPending: boolean;
    error: Error | null;
    refetch: () => void;
  },
  deskSupports: null as boolean | null,
  navigate: vi.fn(),
  botShips: [] as string[],
}));

vi.mock('@tloncorp/api', () => {
  class PromptsUnsupportedError extends Error {}
  class DeskUnsupportedError extends Error {}
  return {
    getBotUserIdForUser: () => '~bot',
    PromptsUnsupportedError,
    DeskUnsupportedError,
  };
});
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUserId: () => '~owner',
}));
vi.mock('../../ui/components/BotSystemPrompts', () => ({
  useBotSystemPrompts: (botShip: string) => {
    mocks.botShips.push(botShip);
    return mocks.query;
  },
  useDeskSupportsPrompts: () => mocks.deskSupports,
  useStewardPromptsFeed: () => {},
}));
vi.mock('../../ui/components/SettingsList', () => ({
  SettingsListScreenView: 'SettingsListScreenView',
}));

setupReactTestEnvironment();

const managed = (body: string) =>
  `<!-- idempotency-marker:tlon-x:v1 -->\n${body}\n<!-- /idempotency-marker -->\n`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deskSupports = null;
  mocks.botShips = [];
  mocks.query = {
    data: [
      { name: 'TOOLS.md', text: managed('tools') },
      { name: 'SOUL.md', text: `Call me Captain.\n${managed('soul')}` },
      { name: 'MEMORY.md', text: `${managed('memory')}\nLearned.\n` },
      { name: 'IDENTITY.md', text: managed('identity') },
      { name: 'AGENTS.md', text: managed('agents') },
    ],
    isPending: false,
    error: null,
    refetch: vi.fn(),
  };
});

async function render(params?: { botShip?: string }) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BotPromptFilesScreen
        navigation={{ goBack: vi.fn(), navigate: mocks.navigate } as never}
        route={{ params } as never}
      />
    );
  });
  return tree;
}

const view = (tree: ReactTestRenderer) =>
  tree.root.find((node) => (node.type as unknown) === 'SettingsListScreenView')
    .props;
const rows = (tree: ReactTestRenderer) => view(tree).sections[0].rows;

describe('BotPromptFilesScreen', () => {
  it('lists the files in order, marking what can and cannot change', async () => {
    const tree = await render();
    expect(
      rows(tree).map((row: { title: string; value?: string }) => [
        row.title,
        row.value,
      ])
    ).toEqual([
      ['Instructions', 'Read-only'],
      ['Personality', 'Customized'],
      ['Identity', undefined],
      ['Memory', 'Read-only'],
      ['Tools', 'Read-only'],
    ]);

    act(() => {
      rows(tree)[1].onPress();
    });
    expect(mocks.navigate).toHaveBeenCalledWith('BotPromptFile', {
      name: 'SOUL.md',
      botShip: '~bot',
    });
  });

  it('says the bot keeps its own memory only when memory is shared', async () => {
    const withMemory = await render();
    expect(view(withMemory).sections[0].footer).toContain(
      'Your bot keeps its own memory.'
    );

    mocks.query = {
      ...mocks.query,
      data: mocks.query.data?.filter((file) => file.name !== 'MEMORY.md'),
    };
    const withoutMemory = await render();
    expect(view(withoutMemory).sections[0].footer).not.toContain('memory');
  });

  it("lists the files of the bot it was opened for, as from that bot's profile", async () => {
    const tree = await render({ botShip: '~other-bot' });
    act(() => {
      rows(tree)[0].onPress();
    });
    expect(mocks.botShips).toEqual(['~other-bot']);
    expect(mocks.navigate).toHaveBeenCalledWith('BotPromptFile', {
      name: 'AGENTS.md',
      botShip: '~other-bot',
    });
  });

  it('shows a spinner until the first read lands', async () => {
    mocks.query = { ...mocks.query, data: undefined, isPending: true };
    const tree = await render();
    expect(view(tree).loading).toBe(true);
  });

  it('offers a retry when the read failed', async () => {
    mocks.query = {
      ...mocks.query,
      data: undefined,
      error: new Error('network'),
    };
    const tree = await render();
    const retry = rows(tree).find(
      (row: { key: string }) => row.key === 'retry'
    );
    act(() => {
      retry.onPress();
    });
    expect(mocks.query.refetch).toHaveBeenCalled();
  });

  it('says so when the ship cannot serve prompt files', async () => {
    mocks.deskSupports = false;
    const tree = await render();
    expect(view(tree).loading).toBe(false);
    expect(rows(tree)).toEqual([
      expect.objectContaining({
        title: "Prompt files aren't available yet.",
        disabled: true,
      }),
    ]);
  });
});
