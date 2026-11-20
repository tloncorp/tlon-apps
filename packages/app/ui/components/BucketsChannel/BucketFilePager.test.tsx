import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../../test/sheetTestUtils';
import { BucketFilePager } from './BucketFilePager';

setupReactTestEnvironment();

it('bounds page wrappers in a large folder while retaining documents and releasing audio', () => {
  const items = Array.from({ length: 10_000 }, (_, index) => ({
    id: String(index),
    name: `file-${index}.pdf`,
    uri: `https://files.test/${index}`,
  }));
  const unmounted = vi.fn();
  function Page({ id }: { id: string }) {
    useEffect(
      () => () => {
        unmounted(id);
      },
      [id]
    );
    return <iframe title={id} />;
  }
  const element = (index: number, retain = true) => (
    <BucketFilePager
      navigation={{ items, index, onSelect: vi.fn() }}
      retainActivePage={retain}
    >
      <Page key={items[index].id} id={items[index].id} />
    </BucketFilePager>
  );
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(element(0));
  });
  const wrappers = () =>
    tree.root.findAll(
      (node) => node.type === 'div' && node.props['aria-hidden'] !== undefined
    );
  expect(wrappers()).toHaveLength(1);
  const firstPage = tree.root.findByProps({ title: '0' });
  act(() => tree.update(element(1)));
  act(() => tree.update(element(0)));
  expect(tree.root.findByProps({ title: '0' })).toBe(firstPage);
  expect(unmounted).not.toHaveBeenCalled();
  for (let index = 2; index < 10; index++) {
    act(() => tree.update(element(index)));
    expect(wrappers().length).toBeLessThanOrEqual(5);
  }
  act(() => tree.update(element(9999, false)));
  expect(wrappers()).toHaveLength(6);
  act(() => tree.update(element(9)));
  expect(wrappers()).toHaveLength(5);
  expect(unmounted).toHaveBeenCalledWith('9999');
  expect(wrappers().filter((node) => !node.props['aria-hidden'])).toHaveLength(
    1
  );
  act(() => tree.unmount());
});
