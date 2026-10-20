import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SettingsSectionsView } from './SettingsSectionsView';
import type { SettingsRowModel } from './types';

vi.mock('tamagui', () => ({
  XStack: 'XStack',
  getConfig: () => ({ fonts: { body: { family: 'Inter' } } }),
  useTheme: () => ({
    background: { val: '#fff' },
    tertiaryText: { val: '#999' },
  }),
}));
vi.mock('react-native', () => ({ Switch: 'Switch' }));
vi.mock('@react-native-picker/picker', async () => {
  const { createElement } = await import('react');
  const Picker = (props: Record<string, unknown>) =>
    createElement('Picker', props);
  return { Picker: Object.assign(Picker, { Item: 'PickerItem' }) };
});
vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
  desktopTypeStyles: { '$label/m': { fontSize: 15 } },
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

function render(row: SettingsRowModel) {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      <SettingsSectionsView sections={[{ key: 'section', rows: [row] }]} />
    );
  });
  return renderer!.root;
}

/** The rendered elements carrying a test ID, by element name. */
function elementsWithTestID(row: SettingsRowModel, testID: string) {
  return render(row)
    .findAll(
      (node) => typeof node.type === 'string' && node.props.testID === testID
    )
    .map((node) => node.type);
}

describe('SettingsSectionsView', () => {
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

  it('announces a choice as a radio button, or a checkbox when several can be on', () => {
    const choice = { key: 'row', title: 'Model', onPress: () => {} };

    const single = render({ ...choice, selected: true }).findByType(
      'Pressable' as never
    );
    expect(single.props.role).toBe('radio');
    expect(single.props['aria-checked']).toBe(true);

    const multiple = render({
      ...choice,
      selected: false,
      multiple: true,
    }).findByType('Pressable' as never);
    expect(multiple.props.role).toBe('checkbox');
    expect(multiple.props['aria-checked']).toBe(false);
  });

  it('puts a picker row’s test ID on its select and reports picks as strings', () => {
    const onChange = vi.fn();
    const row: SettingsRowModel = {
      key: 'row',
      title: 'Everyone',
      picker: {
        value: '1',
        options: [
          { value: '0', title: 'No access' },
          { value: '1', title: 'Can view' },
        ],
        onChange,
      },
      testID: 'AccessLevel-Everyone',
    };
    expect(elementsWithTestID(row, 'AccessLevel-Everyone')).toEqual(['Picker']);

    const select = render(row).findByType('Picker' as never);
    expect(select.props.selectedValue).toBe('1');
    expect(
      select
        .findAllByType('PickerItem' as never)
        .map((item) => item.props.label)
    ).toEqual(['No access', 'Can view']);
    select.props.onValueChange(0);
    expect(onChange).toHaveBeenCalledWith('0');
  });
});
