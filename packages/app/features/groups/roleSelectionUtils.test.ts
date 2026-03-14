import { describe, expect, test } from 'vitest';

import {
  appendCreatedRole,
  areAllIdsSelected,
  getAddedSelectedIds,
  getRemovedSelectedIds,
  getSelectableRoleOptions,
  hasSelectedIdsChanged,
  toggleAllSelectedIds,
  toggleSelectedIds,
} from './roleSelectionUtils';

describe('toggleSelectedIds', () => {
  test('adds an unselected id', () => {
    expect(toggleSelectedIds(['a'], 'b')).toEqual(['a', 'b']);
  });

  test('removes a selected id', () => {
    expect(toggleSelectedIds(['a', 'b'], 'b')).toEqual(['a']);
  });
});

describe('toggleAllSelectedIds', () => {
  test('selects all ids when not all are selected', () => {
    expect(toggleAllSelectedIds(['a', 'b'], ['a'])).toEqual(['a', 'b']);
  });

  test('deselects only matching ids and preserves unrelated selections', () => {
    expect(toggleAllSelectedIds(['a', 'b'], ['a', 'b', 'c'])).toEqual(['c']);
  });
});

describe('selection comparisons', () => {
  test('detects selection changes', () => {
    expect(hasSelectedIdsChanged(['a'], ['a', 'b'])).toBe(true);
    expect(hasSelectedIdsChanged(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  test('calculates added and removed ids', () => {
    expect(getAddedSelectedIds(['a'], ['a', 'b'])).toEqual(['b']);
    expect(getRemovedSelectedIds(['a', 'b'], ['b'])).toEqual(['a']);
  });

  test('detects when all ids are selected', () => {
    expect(areAllIdsSelected(['a', 'b'], ['a', 'b', 'c'])).toBe(true);
    expect(areAllIdsSelected(['a', 'b'], ['a'])).toBe(false);
  });
});

describe('appendCreatedRole', () => {
  test('adds a temporary created role when missing', () => {
    expect(
      appendCreatedRole(
        [{ id: 'admin', title: 'Admin' } as any],
        'writer',
        'Writer'
      )
    ).toEqual([
      { id: 'admin', title: 'Admin' },
      { id: 'writer', title: 'Writer' },
    ]);
  });
});

describe('getSelectableRoleOptions', () => {
  test('excludes admin and includes members plus created role', () => {
    expect(
      getSelectableRoleOptions(
        [{ id: 'admin', title: 'Admin' }, { id: 'mod', title: 'Mod' }] as any,
        'writer',
        'Writer'
      )
    ).toEqual([
      { label: 'Mod', value: 'mod' },
      { label: 'Writer', value: 'writer' },
      { label: 'Members', value: '__MEMBERS_MARKER__' },
    ]);
  });
});
