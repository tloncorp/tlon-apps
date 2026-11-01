import { createElement, type PropsWithChildren } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { VaultLoginDetail } from '@tloncorp/api/client/browserVaultManagement';
import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { SecureVaultView, VaultLoginSheet } from './SecureVaultView';

vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: 800 }),
}));
vi.mock('@tloncorp/ui', () => ({
  ConfirmDialog: 'ConfirmDialog',
  Icon: 'Icon',
}));
vi.mock('../../../ui/components/ActionSheet', () => ({
  ActionSheet: Object.assign(
    ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) =>
      createElement('ActionSheet', props, children),
    { SimpleHeader: 'SimpleHeader' }
  ),
}));
vi.mock('../../../ui/components/SettingsList', () => ({
  SettingsListScreenView: 'SettingsListScreenView',
  SettingsList: 'SettingsList',
  SETTINGS_LIST_COLUMN_WIDTH: 600,
}));
setupReactTestEnvironment();
const login: VaultLoginDetail = {
  key: 'login',
  id: 'item',
  revision: 1,
  origins: ['https://www.wikipedia.org'],
  fields: [
    {
      name: 'email',
      type: 'email',
      sensitive: false,
      hasValue: true,
      value: 'test@example.com',
    },
    {
      name: 'password',
      type: 'password',
      sensitive: true,
      hasValue: true,
      value: 'must-never-render',
    },
  ],
};
const byType = (tree: ReactTestRenderer, type: string) =>
  tree.root.find((node) => (node.type as unknown) === type);

describe('Secure Vault UI', () => {
  it('opens a login from the shared settings list and identifies the bot scope', async () => {
    const select = vi.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <SecureVaultView
          logins={[login]}
          onRefresh={() => {}}
          onSelect={select}
          onBack={() => {}}
        />
      );
    });
    const section = byType(tree, 'SettingsListScreenView').props.sections[0];
    expect(section.footer).toContain('Your Tlonbot will use your vault logins');
    expect(section.rows[0].title).toBe('www.wikipedia.org');
    section.rows[0].onPress();
    expect(select).toHaveBeenCalledWith(login);
    await act(async () => tree.unmount());
  });
  it('shows an error rather than an empty vault when loading fails', async () => {
    let tree!: ReactTestRenderer;
    const retry = vi.fn();
    await act(async () => {
      tree = create(
        <SecureVaultView
          error="Couldn’t load your vault."
          onRefresh={retry}
          onSelect={() => {}}
          onBack={() => {}}
        />
      );
    });
    const rows = byType(tree, 'SettingsListScreenView').props.sections[0].rows;
    expect(rows.map((r: { title: string }) => r.title)).not.toContain(
      'No saved logins'
    );
    rows[1].onPress();
    expect(retry).toHaveBeenCalledOnce();
    await act(async () => tree.unmount());
  });
  it('uses profile settings sections, masks secrets and confirms before removal', async () => {
    let tree!: ReactTestRenderer;
    const remove = vi.fn(),
      close = vi.fn();
    await act(async () => {
      tree = create(
        <VaultLoginSheet
          login={login}
          detail={login}
          loading={false}
          onRetry={() => {}}
          onClose={close}
          onRemove={remove}
        />
      );
    });
    const sections = byType(tree, 'SettingsList').props.sections;
    expect(sections[0].title).toBe('Email');
    expect(sections[0].rows[0].title).toBe('test@example.com');
    expect(sections[1].title).toBe('Password');
    expect(sections[1].rows[0].title).toBe('••••••••');
    expect(sections.at(-1).rows[0].destructive).toBe(true);
    expect(JSON.stringify(sections)).not.toContain('must-never-render');
    await act(async () => sections.at(-1).rows[0].onPress());
    expect(remove).not.toHaveBeenCalled();
    expect(byType(tree, 'ConfirmDialog').props.open).toBe(true);
    await act(async () =>
      byType(tree, 'ConfirmDialog').props.onOpenChange(false)
    );
    expect(remove).not.toHaveBeenCalled();
    await act(async () => sections.at(-1).rows[0].onPress());
    byType(tree, 'ConfirmDialog').props.onConfirm();
    expect(remove).toHaveBeenCalledOnce();
    await act(async () => tree.unmount());
  });
});
