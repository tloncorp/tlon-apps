import { describe, expect, it } from 'vitest';

import { rosterChangeRequiresRestart } from './roster-watch';

const normalize = (ship: string) => (ship.startsWith('~') ? ship : `~${ship}`);
const moons = new Set(['~sonted-tontuc-tinren-pocben']);

describe('rosterChangeRequiresRestart', () => {
  it('restarts for a minted bot the fleet does not run', () => {
    expect(
      rosterChangeRequiresRestart(
        { minted: { ship: '~hidret-nolryg-tinren-pocben' } },
        moons,
        normalize
      )
    ).toBe('minted ~hidret-nolryg-tinren-pocben');
  });

  it('does not restart for a minted bot already running', () => {
    expect(
      rosterChangeRequiresRestart(
        { minted: { ship: '~sonted-tontuc-tinren-pocben' } },
        moons,
        normalize
      )
    ).toBeNull();
  });

  it('normalizes sig-less ships before comparing', () => {
    expect(
      rosterChangeRequiresRestart(
        { minted: { ship: 'sonted-tontuc-tinren-pocben' } },
        moons,
        normalize
      )
    ).toBeNull();
  });

  it('restarts when a running bot is retired', () => {
    expect(
      rosterChangeRequiresRestart(
        { retired: { ship: '~sonted-tontuc-tinren-pocben' } },
        moons,
        normalize
      )
    ).toBe('retired ~sonted-tontuc-tinren-pocben');
  });

  it('ignores retirement of a bot the fleet never ran', () => {
    expect(
      rosterChangeRequiresRestart(
        { retired: { ship: '~hidret-nolryg-tinren-pocben' } },
        moons,
        normalize
      )
    ).toBeNull();
  });

  it('ignores config tweaks and an init matching the fleet', () => {
    expect(
      rosterChangeRequiresRestart({ init: {} }, moons, normalize)
    ).toBeNull();
    expect(
      rosterChangeRequiresRestart(
        { init: { '~sonted-tontuc-tinren-pocben': {} } },
        moons,
        normalize
      )
    ).toBeNull();
    expect(
      rosterChangeRequiresRestart(
        { configured: { ship: '~sonted-tontuc-tinren-pocben' } },
        moons,
        normalize
      )
    ).toBeNull();
  });

  it('restarts when the init snapshot carries a bot minted mid-boot', () => {
    expect(
      rosterChangeRequiresRestart(
        {
          init: {
            '~sonted-tontuc-tinren-pocben': {},
            '~hidret-nolryg-tinren-pocben': {},
          },
        },
        moons,
        normalize
      )
    ).toBe('minted ~hidret-nolryg-tinren-pocben (missed during boot)');
  });

  it('does not restart when a configured moon is absent from init', () => {
    // the default account's moon is legitimately not in the roster
    expect(
      rosterChangeRequiresRestart({ init: {} }, moons, normalize)
    ).toBeNull();
  });

  it('tolerates malformed facts', () => {
    expect(rosterChangeRequiresRestart({}, moons, normalize)).toBeNull();
    expect(
      rosterChangeRequiresRestart({ minted: {} } as never, moons, normalize)
    ).toBeNull();
  });
});
