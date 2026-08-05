import { describe, expect, it, vi } from 'vitest';

import { createNativeHeaderTitleStore } from './nativeTitle';

describe('native header title store', () => {
  it('notifies subscribers only when the title presentation changes', () => {
    const store = createNativeHeaderTitleStore('Initial', 'initial');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set('Equivalent element', 'initial');
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe('Initial');

    store.set('Updated', 'updated');
    expect(store.getSnapshot()).toBe('Updated');
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    store.set('Final', 'final');
    expect(listener).toHaveBeenCalledOnce();
  });
});
