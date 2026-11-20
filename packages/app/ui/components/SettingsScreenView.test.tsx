import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { SettingsScreenView } from './SettingsScreenView';

vi.mock('@tloncorp/ui', () => ({ useIsWindowNarrow: () => false }));
vi.mock('tamagui', () => ({ View: 'View', isWeb: true }));
vi.mock('./ContactNameV2', () => ({ useContactName: () => 'Owner' }));
vi.mock('./ScreenHeader', () => ({ ScreenHeader: 'ScreenHeader' }));
vi.mock('./SettingsList', () => ({
  SettingsList: 'SettingsList',
  useSettingsListHeaderColor: () => 'white',
}));

setupReactTestEnvironment();

const noop = () => {};

async function render(
  props: Partial<Parameters<typeof SettingsScreenView>[0]> = {}
) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SettingsScreenView
        currentUserId="~owner"
        hasHostedAuth={false}
        onNotificationSettingsPressed={noop}
        onBlockedUsersPressed={noop}
        onPrivacyPressed={noop}
        onManageAccountPressed={noop}
        onBotSettingsPressed={noop}
        onScheduledTasksPressed={noop}
        botEnabled
        {...props}
      />
    );
  });
  return tree;
}

type Row = { key: string; isFocused?: boolean; onPress?: () => void };
type Section = { key: string; footer?: string; rows: Row[] };

const findSection = (tree: ReactTestRenderer, key: string) =>
  (
    tree.root.find((node) => (node.type as unknown) === 'SettingsList').props
      .sections as Section[]
  ).find((section) => section.key === key);

const botLinkRows = (tree: ReactTestRenderer): Row[] =>
  findSection(tree, 'bot-link')?.rows ?? [];

describe('SettingsScreenView prompt files row', () => {
  it('follows Scheduled tasks where the bot card is not shown', async () => {
    const onPromptFilesPressed = vi.fn();
    const tree = await render({ onPromptFilesPressed });
    const rows = botLinkRows(tree);
    expect(rows.map((row) => row.key)).toEqual([
      'bot-settings',
      'scheduled-tasks',
      'prompt-files',
    ]);
    rows[2].onPress?.();
    expect(onPromptFilesPressed).toHaveBeenCalledOnce();
  });

  it('is left to the bot card, which has its own Advanced row', async () => {
    const tree = await render({
      onPromptFilesPressed: noop,
      botSections: [{ key: 'bot', rows: [] }],
    });
    expect(botLinkRows(tree).map((row) => row.key)).not.toContain(
      'prompt-files'
    );
  });

  it('is absent without a bot', async () => {
    const tree = await render({
      onPromptFilesPressed: noop,
      botEnabled: false,
    });
    expect(botLinkRows(tree).map((row) => row.key)).not.toContain(
      'prompt-files'
    );
  });

  it.each(['BotPromptFiles', 'BotPromptFile'])(
    'takes the highlight from Bot Settings on %s',
    async (focusedRouteName) => {
      const tree = await render({
        onPromptFilesPressed: noop,
        focusedRouteName,
      });
      const focused = botLinkRows(tree)
        .filter((row) => row.isFocused)
        .map((row) => row.key);
      expect(focused).toEqual(['prompt-files']);
    }
  );
});

describe('SettingsScreenView usage section', () => {
  it('shows storage and bot tokens, saying whose tokens they are', async () => {
    const tree = await render({
      storageLabel: '1.00 GB of 10.00 GB used',
      tokenUsageLabel: '1.2M',
    });
    const usage = findSection(tree, 'usage');
    expect(usage?.rows.map((row) => row.key)).toEqual([
      'storage',
      'token-usage',
    ]);
    expect(usage?.footer).toMatch(/your own API keys/);
  });

  it('drops the token footer where only storage is known', async () => {
    const tree = await render({ storageLabel: '1.00 GB of 10.00 GB used' });
    const usage = findSection(tree, 'usage');
    expect(usage?.rows.map((row) => row.key)).toEqual(['storage']);
    expect(usage?.footer).toBeUndefined();
  });

  it('is absent with nothing to show', async () => {
    const tree = await render();
    expect(findSection(tree, 'usage')).toBeUndefined();
  });
});
