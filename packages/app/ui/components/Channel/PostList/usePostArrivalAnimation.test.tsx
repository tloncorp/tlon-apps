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

vi.mock('react-native-ease', () => ({
  EaseView: 'animated-row',
}));

import type { PostWithNeighbors } from './shared';
import { usePostArrivalAnimation } from './usePostArrivalAnimation';

const sentPost = (id: string, sentAt: string = id) =>
  ({ post: { id, authorId: '~zod', sentAt } }) as unknown as PostWithNeighbors;

const posts = (...ids: string[]) => ids.map((id) => sentPost(id));

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

function row(id: string) {
  return renderer.root
    .findAllByType('animated-row' as never)
    .find((row) => row.findByType('post' as never).props.id === id)!;
}

function initialOpacity(id: string) {
  return row(id).props.initialAnimate?.opacity;
}

function message(id: string, content: unknown): PostWithNeighbors {
  return {
    post: { id, content, authorId: '~zod', sentAt: id },
  } as unknown as PostWithNeighbors;
}

describe('message entry animations', () => {
  it('keeps single-line arrivals at the current timing', () => {
    render({ data: posts('a') });
    update({
      data: [...posts('a'), message('b', [{ inline: ['Hello'] }])],
    });
    expect(row('b').props.transition).toEqual({
      type: 'timing',
      duration: 400,
      easing: 'easeInOut',
    });
  });

  it.each([
    ['paragraphs', [{ inline: ['First line'] }, { inline: ['Second line'] }]],
    ['inline breaks', [{ inline: ['First line\nSecond line'] }]],
    [
      'stored JSON with blank lines',
      JSON.stringify([
        { inline: ['First line'] },
        { inline: [''] },
        { inline: ['Last line'] },
      ]),
    ],
  ])('gives multiline %s a brief delay and a slower fade', (_name, content) => {
    render({ data: posts('a') });
    update({ data: [...posts('a'), message('b', content)] });
    expect(initialOpacity('b')).toBe(0);
    expect(row('b').props.transition).toEqual({
      type: 'timing',
      delay: 100,
      duration: 550,
      easing: 'easeInOut',
    });
    const transition = row('b').props.transition;
    update({ data: [...posts('a'), message('b', [{ inline: ['Updated'] }])] });
    expect(row('b').props.transition).toBe(transition);
  });

  it('does not delay multiline history, disabled animations or recycled rows', () => {
    const data = [
      message('a', [{ inline: ['First'] }, { inline: ['Second'] }]),
    ];
    render({ data });
    expect(initialOpacity('a')).toBeUndefined();
    expect(row('a').props.transition.delay).toBeUndefined();
    const added = [...data, message('b', data[0].post.content)];
    update({ data: added, enabled: false });
    expect(initialOpacity('b')).toBeUndefined();
    expect(row('b').props.transition.delay).toBeUndefined();
    update({ data: added, visible: ['a'] });
    update({ data: added });
    expect(initialOpacity('b')).toBeUndefined();
    expect(row('b').props.transition.delay).toBeUndefined();
  });

  it('keeps malformed content from breaking an arriving row', () => {
    render({ data: posts('a') });
    update({ data: [...posts('a'), message('b', '{not JSON')] });
    expect(initialOpacity('b')).toBe(0);
    expect(row('b').props.transition.duration).toBe(400);
  });

  it('reveals initial data immediately and fades only subsequent arrivals', () => {
    const initial = posts('a');
    render({ data: initial, enabled: false });
    update({ data: initial });
    update({ data: posts('a', 'b', 'c') });
    expect(initialOpacity('a')).toBeUndefined();
    expect(initialOpacity('b')).toBe(0);
    expect(initialOpacity('c')).toBe(0);
    expect(row('a').props.animate.opacity).toBe(1);
    expect(row('a').props.onLayout).toBeUndefined();
  });

  it('provides the entry fade at mount and preserves the row on delivery updates', () => {
    render({ data: posts('a') });
    const data = posts('a', 'b');
    update({ data });
    const arrival = row('b');
    expect(initialOpacity('b')).toBe(0);
    expect(row('b').props.animate.opacity).toBe(1);
    expect(row('b').props.onLayout).toBeUndefined();

    // Retaining the mounted row avoids replaying initialAnimate on delivery.
    update({ data: posts('a', 'b') });
    expect(row('b')).toBe(arrival);
    expect(row('b').props.animate.opacity).toBe(1);
  });

  it('does not replay a fade after virtualization remounts a message', () => {
    render({ data: posts('a') });
    const data = posts('a', 'b');
    update({ data });
    expect(initialOpacity('b')).toBe(0);
    update({ data, visible: ['a'] });
    update({ data });
    expect(initialOpacity('b')).toBeUndefined();
    expect(row('b').props.animate.opacity).toBe(1);
    expect(row('b').props.onLayout).toBeUndefined();
  });

  it('does not fade a newer history page when returning to live mode', () => {
    render({ data: posts('a'), enabled: false });
    update({ data: posts('a', 'b'), enabled: true });
    expect(initialOpacity('b')).toBeUndefined();
  });

  it('leaves arrivals immediate while animations are disabled', () => {
    render({ data: posts('a') });
    update({ data: posts('a', 'b'), enabled: false });
    expect(initialOpacity('b')).toBeUndefined();
    expect(row('b').props.animate.opacity).toBe(1);
    expect(row('b').props.onLayout).toBeUndefined();
  });

  it('keeps a sent message mounted when the host confirms it under a new id', () => {
    render({ data: posts('a') });
    update({ data: [...posts('a'), sentPost('pending', 'b')] });
    const arrival = row('pending');
    update({ data: [...posts('a'), sentPost('confirmed', 'b')] });
    expect(row('confirmed')).toBe(arrival);
  });
});
