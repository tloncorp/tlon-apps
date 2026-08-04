import { describe, expect, it, vi } from 'vitest';

import { createNativeHeaderTitleStore } from './nativeHeaderTitle';

describe('native header title store', () => {
  it('notifies subscribers only when the title changes', () => {
    const store = createNativeHeaderTitleStore('Initial');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set('Initial');
    expect(listener).not.toHaveBeenCalled();

    store.set('Updated');
    expect(store.getSnapshot()).toBe('Updated');
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    store.set('Final');
    expect(listener).toHaveBeenCalledOnce();
  });
});
