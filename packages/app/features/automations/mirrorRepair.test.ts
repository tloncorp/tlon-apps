import { describe, expect, it, vi } from 'vitest';

import { createMirrorRepair, repairableBot } from './mirrorRepair';

const bot = '~pinser-botter-sampel-palnet';

function setup({ checkAfterMs = [10, 20, 30] } = {}) {
  // What the cache would hold: filled by the feed or by a read.
  const mirror = new Set<string>();
  const log: string[] = [];
  const ask = vi.fn(async (ship: string) => {
    log.push(`ask ${ship}`);
  });
  const read = vi.fn(async () => {
    log.push('read');
  });
  const pause = vi.fn(async (ms: number) => {
    log.push(`pause ${ms}`);
  });
  const repair = createMirrorRepair({
    ask,
    read,
    arrived: (ship) => mirror.has(ship),
    pause,
    checkAfterMs,
  });
  // Lets whatever an unprompted try started run to its end.
  const settled = () => repair(bot, { tell: false });
  return { repair, mirror, log, ask, read, pause, settled };
}

describe('createMirrorRepair', () => {
  it('tells the ship, then stops as soon as the feed brings the list', async () => {
    const { repair, mirror, log, pause } = setup();
    pause.mockImplementationOnce(async (ms) => {
      log.push(`pause ${ms}`);
      mirror.add(bot);
    });

    await expect(repair(bot, { tell: true })).resolves.toBe('arrived');
    expect(log).toEqual([`ask ${bot}`, 'pause 10']);
  });

  it('finds a list that only a read of the mirror shows', async () => {
    const { repair, mirror, log, read } = setup();
    read.mockImplementationOnce(async () => {
      log.push('read');
    });
    read.mockImplementationOnce(async () => {
      log.push('read');
      mirror.add(bot);
    });

    await expect(repair(bot, { tell: true })).resolves.toBe('arrived');
    expect(log).toEqual([`ask ${bot}`, 'pause 10', 'read', 'pause 20', 'read']);
  });

  it('says so when the list has still not come after every check', async () => {
    const { repair, log, ask } = setup();

    await expect(repair(bot, { tell: true })).resolves.toBe('nothing');
    expect(ask).toHaveBeenCalledTimes(1);
    expect(log).toEqual([
      `ask ${bot}`,
      'pause 10',
      'read',
      'pause 20',
      'read',
      'pause 30',
      'read',
    ]);
  });

  it('keeps checking when a read fails', async () => {
    const { repair, mirror, read, pause } = setup();
    read.mockRejectedValueOnce(new TypeError('Network request failed'));
    pause.mockImplementationOnce(async () => {});
    pause.mockImplementationOnce(async () => {
      mirror.add(bot);
    });

    await expect(repair(bot, { tell: true })).resolves.toBe('arrived');
  });

  it('reports a ship that could not be told, without waiting', async () => {
    const { repair, ask, read, pause } = setup();
    ask.mockRejectedValueOnce(new Error('nack'));

    await expect(repair(bot, { tell: true })).resolves.toBe('failed');
    expect(pause).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('only reads when it may not tell the ship', async () => {
    const { repair, ask, log } = setup();

    await expect(repair(bot, { tell: false })).resolves.toBe('nothing');
    expect(ask).not.toHaveBeenCalled();
    expect(log).toEqual(['read']);
  });

  it('joins a repair already out for the same bot', async () => {
    const { repair, ask } = setup();

    const first = repair(bot, { tell: true });
    const second = repair(bot, { tell: true });

    expect(second).toBe(first);
    await first;
    expect(ask).toHaveBeenCalledTimes(1);
  });

  describe('what a screen is shown', () => {
    it('is busy while a try is out, then that nothing came', async () => {
      const { repair } = setup();
      const seen: (string | undefined)[] = [];
      repair.subscribe(() => seen.push(repair.attempt(bot)));

      expect(repair.attempt(bot)).toBeUndefined();
      const trying = repair(bot, { tell: true });
      expect(repair.attempt(bot)).toBe('asking');
      await trying;

      expect(repair.attempt(bot)).toBe('nothing');
      expect(seen).toEqual(['asking', 'nothing']);
    });

    it('is busy, then nothing at all once the list is there', async () => {
      const { repair, mirror, pause } = setup();
      pause.mockImplementationOnce(async () => {
        mirror.add(bot);
      });

      const trying = repair(bot, { tell: true });
      expect(repair.attempt(bot)).toBe('asking');
      await trying;

      expect(repair.attempt(bot)).toBeUndefined();
    });

    it('is that the ship could not be told', async () => {
      const { repair, ask } = setup();
      ask.mockRejectedValueOnce(new Error('nack'));

      await repair(bot, { tell: true });

      expect(repair.attempt(bot)).toBe('failed');
    });

    it('goes busy again on another try', async () => {
      const { repair } = setup();
      await repair(bot, { tell: true });

      const again = repair(bot, { tell: true });
      expect(repair.attempt(bot)).toBe('asking');
      await again;
    });

    it('keeps one bot apart from another', async () => {
      const { repair } = setup();

      await repair(bot, { tell: true });

      expect(repair.attempt('~pinser-botter-dozzod-dozzod')).toBeUndefined();
    });

    it('stops telling a screen that has gone', async () => {
      const { repair } = setup();
      const listener = vi.fn();
      const stop = repair.subscribe(listener);
      stop();

      await repair(bot, { tell: true });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('unprompted', () => {
    it('tells the ship once per bot, however often it is asked to', async () => {
      const { repair, ask, settled } = setup();

      repair.unprompted(bot);
      repair.unprompted(bot);
      await settled();
      repair.unprompted(bot);
      await settled();

      expect(ask).toHaveBeenCalledTimes(1);
    });

    it('says whether the ship has been told about a bot', async () => {
      const { repair, settled } = setup();
      expect(repair.told(bot)).toBe(false);

      await repair(bot, { tell: false });
      expect(repair.told(bot)).toBe(false);

      repair.unprompted(bot);
      expect(repair.told(bot)).toBe(true);
      await settled();
      expect(repair.told(bot)).toBe(true);
      expect(repair.told('~pinser-botter-dozzod-dozzod')).toBe(false);
    });

    it('shows a screen that opens mid-try the try already out', async () => {
      const { repair, settled } = setup();

      repair.unprompted(bot);
      repair.unprompted(bot);

      expect(repair.attempt(bot)).toBe('asking');
      await settled();
      expect(repair.attempt(bot)).toBe('nothing');
    });

    it('does not try again after a ship that could not be told', async () => {
      const { repair, ask, settled } = setup();
      ask.mockRejectedValueOnce(new Error('nack'));

      repair.unprompted(bot);
      await settled();
      repair.unprompted(bot);
      await settled();

      expect(ask).toHaveBeenCalledTimes(1);
    });

    it('stays out of the way once a refresh has told the ship', async () => {
      const { repair, ask, settled } = setup();

      await repair(bot, { tell: true });
      repair.unprompted(bot);
      await settled();

      expect(ask).toHaveBeenCalledTimes(1);
    });

    it('still runs after a refresh that only read', async () => {
      const { repair, ask, settled } = setup();

      await repair(bot, { tell: false });
      repair.unprompted(bot);
      await settled();

      expect(ask).toHaveBeenCalledTimes(1);
    });

    it('keeps each bot to its own one try', async () => {
      const { repair, ask } = setup();
      const other = '~pinser-botter-dozzod-dozzod';

      repair.unprompted(bot);
      repair.unprompted(other);
      await repair(bot, { tell: false });
      await repair(other, { tell: false });

      expect(ask.mock.calls).toEqual([[bot], [other]]);
    });

    it('leaves a refresh free to tell the ship again', async () => {
      const { repair, ask, settled } = setup();

      repair.unprompted(bot);
      await settled();
      await repair(bot, { tell: true });

      expect(ask).toHaveBeenCalledTimes(2);
    });
  });
});

describe('repairableBot', () => {
  it("is the owner's own bot when that is the list on show", () => {
    expect(repairableBot(bot, bot)).toBe(bot);
  });

  it('is nothing for a list opened for any other ship', () => {
    expect(repairableBot('~zod', bot)).toBeUndefined();
    expect(repairableBot('~pinser-botter-dozzod-dozzod', bot)).toBeUndefined();
  });

  it('is nothing before the owner is known', () => {
    expect(repairableBot('', '')).toBeUndefined();
  });
});
