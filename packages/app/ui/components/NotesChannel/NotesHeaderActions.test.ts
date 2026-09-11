import { describe, expect, it, vi } from 'vitest';

import { visibleScreenHeaderActions } from '../ScreenHeader/actions';
import { createNotesHeaderActions } from './NotesHeaderActions';

vi.mock('../ScreenHeader/primitives', () => ({
  ScreenHeaderItemElements: () => null,
}));

describe('notes header actions', () => {
  it.each([
    [false, false, []],
    [false, true, ['NotesSearchHeaderAction']],
    [true, false, ['NotesRootNewHeaderAction']],
    [true, true, ['NotesSearchHeaderAction', 'NotesRootNewHeaderAction']],
  ])('preserves edit and search gates (%s, %s)', (canEdit, canSearch, ids) => {
    const actions = visibleScreenHeaderActions(
      createNotesHeaderActions({
        canEdit,
        onNew: vi.fn(),
        onSearch: canSearch ? vi.fn() : undefined,
      })
    );
    expect(actions.map((action) => action.id)).toEqual(ids);
  });

  it('dispatches search and creation from the shared action model', () => {
    const onNew = vi.fn();
    const onSearch = vi.fn();
    const actions = createNotesHeaderActions({
      canEdit: true,
      onNew,
      onSearch,
    });
    for (const action of actions) {
      if ('onPress' in action) action.onPress?.();
    }
    expect(onNew).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledOnce();
    expect(actions[1]).toMatchObject({ text: 'New' });
    expect(
      createNotesHeaderActions({
        canEdit: true,
        onNew,
        primaryActionVariant: 'icon',
      })[1]
    ).toMatchObject({ icon: 'Add', label: 'New' });
  });
});
