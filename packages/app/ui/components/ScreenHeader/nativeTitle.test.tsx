import { describe, expect, it, vi } from 'vitest';

import { createNativeHeaderTitleStore } from './nativeTitle';

describe('native header title store', () => {
  it('notifies subscribers when the rendered title changes', () => {
    const store = createNativeHeaderTitleStore('Initial');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set('Initial');
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe('Initial');

    const updatedTitle = <span>Updated avatar</span>;
    store.set(updatedTitle);
    expect(store.getSnapshot()).toBe(updatedTitle);
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    store.set('Final');
    expect(listener).toHaveBeenCalledOnce();
  });
});
