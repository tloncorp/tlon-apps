import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SettingsSectionsView } from './SettingsSectionsView';
import type { SettingsRowModel } from './types';

vi.mock('tamagui', () => ({ XStack: 'XStack' }));
vi.mock('react-native', () => ({ Switch: 'Switch' }));
vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('../Badge', () => ({ Badge: 'Badge' }));
vi.mock('../Form', () => ({ TextInput: 'TextInput' }));
vi.mock('../ListItem', async () => {
  const { createElement } = await import('react');
  const ListItem = (props: Record<string, unknown>) =>
    createElement('ListItem', props);
  return {
    ListItem: Object.assign(ListItem, {
      MainContent: 'ListItemMainContent',
      Title: 'ListItemTitle',
      Subtitle: 'ListItemSubtitle',
    }),
  };
});
vi.mock('../SettingsSection', () => ({
  SettingsSection: 'SettingsSection',
  SettingsDivider: 'SettingsDivider',
}));
vi.mock('./SettingsRowLeading', () => ({
  SettingsRowLeading: 'SettingsRowLeading',
}));

/** The rendered elements carrying a test ID, by element name. */
function elementsWithTestID(row: SettingsRowModel, testID: string) {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      <SettingsSectionsView sections={[{ key: 'section', rows: [row] }]} />
    );
  });
  return renderer!.root
    .findAll(
      (node) => typeof node.type === 'string' && node.props.testID === testID
    )
    .map((node) => node.type);
}

describe('SettingsSectionsView test IDs', () => {
  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it('puts a toggle row’s test ID on its switch', () => {
    expect(
      elementsWithTestID(
        {
          key: 'row',
          title: 'Show deleted messages',
          toggle: { value: false, onValueChange: () => {} },
          testID: 'ShowDeleteMarkersToggle',
        },
        'ShowDeleteMarkersToggle'
      )
    ).toEqual(['Switch']);
  });

  it('puts a plain row’s test ID on the row', () => {
    expect(
      elementsWithTestID(
        { key: 'row', title: 'Version', value: '1.0', testID: 'VersionRow' },
        'VersionRow'
      )
    ).toEqual(['ListItem']);
  });

  it('puts a pressable row’s test ID on its pressable only', () => {
    expect(
      elementsWithTestID(
        {
          key: 'row',
          title: 'Privacy',
          onPress: () => {},
          testID: 'PrivacyRow',
        },
        'PrivacyRow'
      )
    ).toEqual(['Pressable']);
  });
});
