import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { ActionGroup } from '../ActionSheet';
import { NotesActionMenu } from '../NotesChannel/NotesActions';
import { BucketPreviewActions } from './BucketPreviewActions';

vi.mock('../../hooks/useIsNativeSheet', () => ({
  useIsNativeSheet: () => false,
}));
vi.mock('../ActionSheet', () => ({
  createActionGroups: (...inputs: Array<[string, ...unknown[]] | undefined>) =>
    inputs.filter(Boolean).map((input) => {
      const [accent, ...actions] = input!;
      return { accent, actions: actions.filter(Boolean) };
    }),
}));
vi.mock('../NotesChannel/NotesActions', () => ({
  NotesActionMenu: () => null,
}));
vi.mock('../OverflowMenuButton', () => ({
  OverflowTriggerButton: () => null,
}));

function render(props: Parameters<typeof BucketPreviewActions>[0]) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<BucketPreviewActions {...props} />);
  });
  return renderer;
}

describe('BucketPreviewActions', () => {
  it('puts open and delete in the same menu and runs the selected action', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    const renderer = render({ onOpen, onDelete });
    const menu = () => renderer.root.findByType(NotesActionMenu).props;
    const groups: ActionGroup[] = menu().groups;
    expect(
      groups.map((group) => group.actions.map((action) => action.title))
    ).toEqual([['Open in browser', 'Delete file']]);
    expect(groups[0].actions[1].accent).toBe('negative');
    for (const action of groups[0].actions) {
      act(() => menu().trigger.props.onPress());
      act(() => menu().onAction(action.action));
      expect(menu().open).toBe(false);
    }
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it('keeps the open menu available without delete permission', () => {
    const renderer = render({ onOpen: vi.fn() });
    const groups: ActionGroup[] =
      renderer.root.findByType(NotesActionMenu).props.groups;
    expect(groups).toHaveLength(1);
    expect(groups[0].actions).toHaveLength(1);
    expect(groups[0].actions[0].title).toBe('Open in browser');
    expect(groups[0].actions[0].disabled).toBe(false);
    act(() => renderer.unmount());
  });

  it('disables open until the file is ready', () => {
    const renderer = render({ onDelete: vi.fn() });
    const groups: ActionGroup[] =
      renderer.root.findByType(NotesActionMenu).props.groups;
    expect(groups[0].actions[0].disabled).toBe(true);
    expect(groups[0].actions[1].title).toBe('Delete file');
    act(() => renderer.unmount());
  });
});
