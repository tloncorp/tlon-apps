import { describe, expect, it, vi } from 'vitest';

import { positionFixtureList } from './scrollFixturePosition';

function setup() {
  let revision = 0;
  const advance = () => {
    revision++;
  };
  const commands = {
    scrollToEnd: vi.fn(advance),
    scrollToStart: vi.fn(advance),
    scrollToPost: vi.fn(advance),
    captureScrollIntent: () => {
      const captured = revision;
      return () => captured === revision;
    },
  };
  const state = {
    scroll: 900,
    scrollLength: 500,
    data: ['a', 'b', 'c', 'd'].map((id) => ({ post: { id } })),
    positionAtIndex: (index: number) => [0, 200, 900, 1100][index],
    sizeAtIndex: (index: number) => [50, 200, 200, 150][index],
  };
  const read = vi.fn(() => state) as unknown as Parameters<
    typeof positionFixtureList
  >[1];
  const pause = vi.fn(async (_ms: number) => {});
  return { commands, state, read, pause, advance };
}

describe('component fixture uses production navigation ownership', () => {
  it.each(['end', 'top'] as const)(
    'uses public %s commands without diagnostic writes or geometry reads',
    async (where) => {
      const x = setup();
      const result = await positionFixtureList(
        x.commands,
        x.read,
        where,
        x.pause
      );
      expect(x.commands.scrollToEnd).toHaveBeenCalledTimes(1);
      expect(x.commands.scrollToEnd).toHaveBeenCalledWith({ animated: false });
      expect(x.commands.scrollToStart).toHaveBeenCalledTimes(
        where === 'top' ? 1 : 0
      );
      expect(x.commands.scrollToPost).not.toHaveBeenCalled();
      expect(x.read).not.toHaveBeenCalled();
      expect(result.source).toBe('production-imperative-handle');
    }
  );

  it.each([
    ['near', 'c'],
    ['history', 'b'],
  ] as const)(
    'selects variable-height %s history through scrollToPost',
    async (where, postId) => {
      const x = setup();
      const result = await positionFixtureList(
        x.commands,
        x.read,
        where,
        x.pause
      );
      expect(x.commands.scrollToPost).toHaveBeenCalledTimes(1);
      expect(x.commands.scrollToPost).toHaveBeenCalledWith({
        postId,
        viewPosition: 0.5,
        animated: false,
      });
      expect(result.postId).toBe(postId);
      expect(x.pause.mock.calls).toEqual([[500], [600]]);
    }
  );

  it('stops before a history command when the visible visit is superseded', async () => {
    const x = setup();
    x.pause.mockImplementationOnce(async () => x.advance());
    await expect(
      positionFixtureList(x.commands, x.read, 'history', x.pause)
    ).rejects.toThrow('superseded');
    expect(x.commands.scrollToPost).not.toHaveBeenCalled();
  });

  it('cannot report successful setup if the final wait outlives its command', async () => {
    const x = setup();
    x.pause.mockImplementation(async (ms) => {
      if (ms === 600) x.advance();
    });
    await expect(
      positionFixtureList(x.commands, x.read, 'history', x.pause)
    ).rejects.toThrow('superseded');
  });

  it('fails when metrics cannot identify any valid post', async () => {
    const x = setup();
    x.state.sizeAtIndex = () => NaN;
    await expect(
      positionFixtureList(x.commands, x.read, 'near', x.pause)
    ).rejects.toThrow('no valid target');
    expect(x.commands.scrollToPost).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, 0, -1])(
    'rejects malformed viewport %s at the geometry boundary',
    async (size) => {
      const x = setup();
      x.state.scrollLength = size;
      await expect(
        positionFixtureList(x.commands, x.read, 'near', x.pause)
      ).rejects.toThrow('finite list geometry');
      expect(x.commands.scrollToPost).not.toHaveBeenCalled();
    }
  );
});
