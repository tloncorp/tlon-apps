import { useEffect } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { NativeHeaderTitle, createNativeHeaderTitleStore } from './nativeTitle';

describe('native header title store', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

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

  it('updates a stateful title without remounting it', () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();

    function StatefulTitle({ text }: { text: string }) {
      useEffect(() => {
        mounted();
        return () => {
          unmounted();
        };
      }, []);

      return <span>{text}</span>;
    }

    const store = createNativeHeaderTitleStore(
      <StatefulTitle text="Connecting..." />
    );
    let renderer: ReactTestRenderer;

    act(() => {
      renderer = create(<NativeHeaderTitle store={store} />);
    });

    act(() => {
      store.set(<StatefulTitle text="Syncing with node..." />);
    });

    expect(mounted).toHaveBeenCalledOnce();
    expect(unmounted).not.toHaveBeenCalled();
    expect(renderer!.toJSON()).toMatchObject({
      children: ['Syncing with node...'],
    });

    act(() => {
      renderer!.unmount();
    });
    expect(unmounted).toHaveBeenCalledOnce();
  });

  it('remounts a stateful title when the owning store changes', () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();

    function StatefulTitle({ text }: { text: string }) {
      useEffect(() => {
        mounted();
        return () => {
          unmounted();
        };
      }, []);

      return <span>{text}</span>;
    }

    function InstalledTitle({
      ownerKey,
      store,
    }: {
      ownerKey: string;
      store: ReturnType<typeof createNativeHeaderTitleStore>;
    }) {
      return (
        <div>
          <NativeHeaderTitle key={ownerKey} store={store} />
        </div>
      );
    }

    const homeStore = createNativeHeaderTitleStore(
      <StatefulTitle text="Home" />
    );
    const activityStore = createNativeHeaderTitleStore(
      <StatefulTitle text="Activity" />
    );
    let renderer: ReactTestRenderer;

    act(() => {
      renderer = create(<InstalledTitle ownerKey="home" store={homeStore} />);
    });

    act(() => {
      renderer!.update(
        <InstalledTitle ownerKey="activity" store={activityStore} />
      );
    });

    expect(mounted).toHaveBeenCalledTimes(2);
    expect(unmounted).toHaveBeenCalledOnce();
    expect(renderer!.toJSON()).toMatchObject({
      children: [{ children: ['Activity'] }],
    });

    act(() => {
      renderer!.unmount();
    });
    expect(unmounted).toHaveBeenCalledTimes(2);
  });
});
