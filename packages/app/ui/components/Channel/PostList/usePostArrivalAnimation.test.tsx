import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('react-native-reanimated', () => ({
  default: { View: 'animated-row' },
  Easing: { out: () => null, quad: null },
  FadeIn: { duration: () => ({ easing: () => 'fade-in' }) },
}));

import type { PostWithNeighbors } from './shared';
import { usePostArrivalAnimation } from './usePostArrivalAnimation';

const posts = (...ids: string[]) =>
  ids.map((id) => ({ post: { id } }) as PostWithNeighbors);

function List({
  data,
  enabled = true,
  visible = data.map(({ post }) => post.id),
}: {
  data: PostWithNeighbors[];
  enabled?: boolean;
  visible?: string[];
}) {
  const renderItem = usePostArrivalAnimation({
    posts: data,
    enabled,
    renderItem: ({ item }) => React.createElement('post', { id: item.post.id }),
  });
  return (
    <>
      {data.flatMap((item, index) =>
        visible.includes(item.post.id) ? [renderItem({ item, index })] : []
      )}
    </>
  );
}

let renderer: ReactTestRenderer;
beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterAll(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  act(() => renderer?.unmount());
});

function render(props: React.ComponentProps<typeof List>) {
  act(() => {
    renderer = create(<List {...props} />);
  });
}

function update(props: React.ComponentProps<typeof List>) {
  act(() => renderer.update(<List {...props} />));
}

function entering(id: string) {
  return renderer.root
    .findAllByType('animated-row' as never)
    .find((row) => row.findByType('post' as never).props.id === id)?.props
    .entering;
}

describe('message entry animations', () => {
  it('reveals initial data immediately and fades only subsequent arrivals', () => {
    const initial = posts('a');
    render({ data: initial, enabled: false });
    update({ data: initial });
    update({ data: posts('a', 'b', 'c') });
    expect(entering('a')).toBeUndefined();
    expect(entering('b')).toBe('fade-in');
    expect(entering('c')).toBe('fade-in');
  });

  it('does not replay a fade after virtualization remounts a message', () => {
    render({ data: posts('a') });
    const data = posts('a', 'b');
    update({ data });
    expect(entering('b')).toBe('fade-in');
    update({ data, visible: ['a'] });
    update({ data });
    expect(entering('b')).toBeUndefined();
  });

  it('does not fade a newer history page when returning to live mode', () => {
    render({ data: posts('a'), enabled: false });
    update({ data: posts('a', 'b'), enabled: true });
    expect(entering('b')).toBeUndefined();
  });

  it('leaves arrivals immediate while animations are disabled', () => {
    render({ data: posts('a') });
    update({ data: posts('a', 'b'), enabled: false });
    expect(entering('b')).toBeUndefined();
  });
});
