import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeShip } from '../targets.js';
import {
  type Roster,
  type RosterFact,
  applyRosterFact,
  applyFleetToConfig,
  computeFleetAgents,
  createFleetReconciler,
  ensureBotWorkspace,
  fleetConfigUpToDate,
} from './fleet-reconcile.js';

const MOON_A = '~sonted-tontuc-tinren-pocben';
const MOON_B = '~wanzod-wanzod-tinren-pocben';
const ACCT_A = MOON_A.slice(1);
const ACCT_B = MOON_B.slice(1);

const botA = {
  nickname: 'neo',
  model: 'gpt',
  harness: 'openclaw',
  persona: 'the one',
};
const botB = {
  nickname: 'trinity',
  model: '',
  harness: 'openclaw',
  persona: 'also here',
};

function initFact(): RosterFact {
  return { init: { [MOON_A]: botA, [MOON_B]: botB } };
}

function freshConfig(): OpenClawConfig {
  return {
    channels: { tlon: { enabled: true, ship: '~tinren-pocben' } },
  } as unknown as OpenClawConfig;
}

type AnyCfg = {
  channels: { tlon: { accounts?: Record<string, any> } };
  agents?: {
    entries?: Record<string, any>;
    defaults?: { models?: Record<string, any> };
  };
  bindings?: any[];
};

describe('applyRosterFact', () => {
  it('replaces the roster on %init and folds deltas', () => {
    let roster: Roster = new Map();
    roster = applyRosterFact(roster, initFact(), normalizeShip);
    expect([...roster.keys()].sort()).toEqual([MOON_A, MOON_B].sort());

    roster = applyRosterFact(
      roster,
      { retired: { ship: MOON_A } },
      normalizeShip
    );
    expect(roster.has(MOON_A)).toBe(false);

    roster = applyRosterFact(
      roster,
      { minted: { ship: MOON_A, bot: { ...botA, nickname: 'morpheus' } } },
      normalizeShip
    );
    expect(roster.get(MOON_A)?.nickname).toBe('morpheus');

    roster = applyRosterFact(
      roster,
      { configured: { ship: MOON_B, bot: { ...botB, model: 'claude' } } },
      normalizeShip
    );
    expect(roster.get(MOON_B)?.model).toBe('claude');

    // A later %init (SSE resubscribe) wins outright.
    roster = applyRosterFact(roster, { init: {} }, normalizeShip);
    expect(roster.size).toBe(0);
  });

  it('normalizes sigil-less ships', () => {
    const roster = applyRosterFact(
      new Map(),
      { minted: { ship: ACCT_A, bot: botA } },
      normalizeShip
    );
    expect(roster.has(MOON_A)).toBe(true);
  });
});

describe('computeFleetAgents', () => {
  it('skips the default account moon and sorts stably', () => {
    const roster = applyRosterFact(new Map(), initFact(), normalizeShip);
    const all = computeFleetAgents(roster, null);
    expect(all.map((d) => d.acct)).toEqual([ACCT_A, ACCT_B].sort());

    const minusDefault = computeFleetAgents(roster, MOON_A);
    expect(minusDefault.map((d) => d.moon)).toEqual([MOON_B]);
  });

  it('carries an empty model as null', () => {
    const roster = applyRosterFact(new Map(), initFact(), normalizeShip);
    const agents = computeFleetAgents(roster, null);
    expect(agents.find((d) => d.moon === MOON_B)?.model).toBeNull();
  });

  it('skips bots the roster assigns to another harness', () => {
    const roster = applyRosterFact(
      new Map(),
      {
        init: {
          [MOON_A]: { ...botA, harness: 'hermes' },
          [MOON_B]: { ...botB, harness: '' },
        },
      },
      normalizeShip
    );
    const agents = computeFleetAgents(roster, null);
    expect(agents.map((d) => d.moon)).toEqual([MOON_B]);
  });
});

describe('applyFleetToConfig', () => {
  function reconciled(cfg = freshConfig(), defaultMoon: string | null = null) {
    const roster = applyRosterFact(new Map(), initFact(), normalizeShip);
    applyFleetToConfig(
      cfg,
      computeFleetAgents(roster, defaultMoon),
      normalizeShip
    );
    return cfg as unknown as AnyCfg;
  }

  it('creates an account, agent entry, binding, and model allowlist entry per bot', () => {
    const cfg = reconciled();
    expect(cfg.channels.tlon.accounts?.[ACCT_A]).toEqual({
      enabled: true,
      // Seeded off so a fleet of bots doesn't all answer the owner at once.
      ownerListenEnabled: false,
      moon: MOON_A,
      moonNickname: 'neo',
    });
    expect(cfg.agents?.entries?.[ACCT_A]).toEqual({
      identity: { name: 'neo' },
      model: { primary: 'gpt' },
    });
    // No model in the rig: the agent falls through to the default model.
    expect(cfg.agents?.entries?.[ACCT_B]).toEqual({
      identity: { name: 'trinity' },
    });
    expect(cfg.agents?.defaults?.models).toEqual({ gpt: {} });
    expect(cfg.bindings).toContainEqual({
      agentId: ACCT_A,
      match: { channel: 'tlon', accountId: ACCT_A },
    });
  });

  it('carries the roster avatar onto the account and drops it when cleared', () => {
    const cfg = freshConfig() as unknown as AnyCfg;
    const withAvatar = applyRosterFact(
      new Map(),
      { init: { [MOON_A]: { ...botA, avatar: 'https://x/a.png' } } },
      normalizeShip
    );
    applyFleetToConfig(
      cfg as unknown as OpenClawConfig,
      computeFleetAgents(withAvatar, null),
      normalizeShip
    );
    expect(cfg.channels.tlon.accounts?.[ACCT_A].moonAvatar).toBe(
      'https://x/a.png'
    );

    const cleared = applyRosterFact(
      withAvatar,
      { configured: { ship: MOON_A, bot: botA } },
      normalizeShip
    );
    applyFleetToConfig(
      cfg as unknown as OpenClawConfig,
      computeFleetAgents(cleared, null),
      normalizeShip
    );
    expect(cfg.channels.tlon.accounts?.[ACCT_A].moonAvatar).toBeUndefined();
  });

  it('clears the model override when the roster reverts to the default', () => {
    const cfg = reconciled() as unknown as AnyCfg;
    expect(cfg.agents?.entries?.[ACCT_A].model).toEqual({ primary: 'gpt' });

    const reverted = applyRosterFact(
      applyRosterFact(new Map(), initFact(), normalizeShip),
      { configured: { ship: MOON_A, bot: { ...botA, model: '' } } },
      normalizeShip
    );
    applyFleetToConfig(
      cfg as unknown as OpenClawConfig,
      computeFleetAgents(reverted, null),
      normalizeShip
    );
    expect(cfg.agents?.entries?.[ACCT_A].model).toBeUndefined();
  });

  it('pins the pre-fleet default agent when fleet entries arrive', () => {
    // No entries at all: the implicit `main` agent gets an explicit marker.
    const bare = reconciled() as unknown as AnyCfg;
    expect(bare.agents?.entries?.main).toEqual({ default: true });

    // One pre-existing entry: it becomes the marked default.
    const cfg = freshConfig() as unknown as AnyCfg;
    cfg.agents = { entries: { helper: { identity: { name: 'helper' } } } };
    reconciled(cfg as unknown as OpenClawConfig);
    expect(cfg.agents?.entries?.helper.default).toBe(true);
    expect(cfg.agents?.entries?.main).toBeUndefined();

    // An existing marker is left alone.
    const marked = freshConfig() as unknown as AnyCfg;
    marked.agents = { entries: { helper: { default: true } } };
    reconciled(marked as unknown as OpenClawConfig);
    expect(marked.agents?.entries?.main).toBeUndefined();
  });

  it('removes a retired bot everywhere while keeping hand-written config', () => {
    const cfg = reconciled() as unknown as OpenClawConfig;
    const anyCfg = cfg as unknown as AnyCfg;
    anyCfg.channels.tlon.accounts!.custom = { enabled: true, moon: '~zod' };
    anyCfg.agents!.entries!.helper = { identity: { name: 'helper' } };
    anyCfg.bindings!.push({ agentId: 'helper', match: { channel: 'discord' } });

    const roster = applyRosterFact(
      applyRosterFact(new Map(), initFact(), normalizeShip),
      { retired: { ship: MOON_A } },
      normalizeShip
    );
    applyFleetToConfig(cfg, computeFleetAgents(roster, null), normalizeShip);

    expect(anyCfg.channels.tlon.accounts?.[ACCT_A]).toBeUndefined();
    expect(anyCfg.agents?.entries?.[ACCT_A]).toBeUndefined();
    expect(anyCfg.bindings!.some((b) => b.match?.accountId === ACCT_A)).toBe(
      false
    );
    // Survivors: the other bot, the hand-written account (its id does not
    // match its moon), the hand-written agent, the non-tlon binding.
    expect(anyCfg.channels.tlon.accounts?.[ACCT_B]).toBeDefined();
    expect(anyCfg.channels.tlon.accounts?.custom).toBeDefined();
    expect(anyCfg.agents?.entries?.helper).toBeDefined();
    expect(anyCfg.bindings!.some((b) => b.match?.channel === 'discord')).toBe(
      true
    );
  });

  it('preserves operator fields and an explicit disable on a fleet account', () => {
    const cfg = reconciled() as unknown as OpenClawConfig;
    const anyCfg = cfg as unknown as AnyCfg;
    anyCfg.channels.tlon.accounts![ACCT_A].dmAllowlist = ['~zod'];
    anyCfg.channels.tlon.accounts![ACCT_A].enabled = false;
    anyCfg.agents!.entries![ACCT_A].workspace = '/custom/ws';

    const roster = applyRosterFact(new Map(), initFact(), normalizeShip);
    applyFleetToConfig(cfg, computeFleetAgents(roster, null), normalizeShip);

    expect(anyCfg.channels.tlon.accounts?.[ACCT_A].dmAllowlist).toEqual([
      '~zod',
    ]);
    expect(anyCfg.channels.tlon.accounts?.[ACCT_A].enabled).toBe(false);
    expect(anyCfg.agents?.entries?.[ACCT_A].workspace).toBe('/custom/ws');
  });

  it('never removes models from the operator-owned allowlist', () => {
    const cfg = freshConfig() as unknown as AnyCfg;
    cfg.agents = { defaults: { models: { legacy: {} } } };
    reconciled(cfg as unknown as OpenClawConfig);
    expect(Object.keys(cfg.agents!.defaults!.models!).sort()).toEqual([
      'gpt',
      'legacy',
    ]);
  });

  it('is idempotent', () => {
    const cfg = reconciled() as unknown as OpenClawConfig;
    const once = JSON.stringify(cfg);
    const roster = applyRosterFact(new Map(), initFact(), normalizeShip);
    const desired = computeFleetAgents(roster, null);
    expect(fleetConfigUpToDate(cfg, desired, normalizeShip)).toBe(true);
    applyFleetToConfig(cfg, desired, normalizeShip);
    expect(JSON.stringify(cfg)).toBe(once);
  });

  it('reports a pending change before the first apply', () => {
    const cfg = freshConfig();
    const roster = applyRosterFact(new Map(), initFact(), normalizeShip);
    expect(
      fleetConfigUpToDate(cfg, computeFleetAgents(roster, null), normalizeShip)
    ).toBe(false);
  });
});

describe('ensureBotWorkspace', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tlon-fleet-ws-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('seeds SOUL.md and IDENTITY.md once and never rewrites them', async () => {
    const ws = join(dir, 'workspace-a');
    const params = {
      dir: ws,
      moon: MOON_A,
      nickname: 'neo',
      persona: 'the one',
    };
    expect(await ensureBotWorkspace(params)).toBe(true);
    expect(readFileSync(join(ws, 'SOUL.md'), 'utf8')).toContain('You are neo.');
    expect(readFileSync(join(ws, 'SOUL.md'), 'utf8')).toContain('the one');
    expect(readFileSync(join(ws, 'IDENTITY.md'), 'utf8')).toContain(
      `Ship: ${MOON_A}`
    );
    expect(await ensureBotWorkspace(params)).toBe(false);
    // The workspace owns the files after the seed: a roster change must not
    // revert edits the owner made through the steward prompts flow.
    expect(await ensureBotWorkspace({ ...params, persona: 'rewritten' })).toBe(
      false
    );
    expect(readFileSync(join(ws, 'SOUL.md'), 'utf8')).toContain('the one');
  });
});

describe('createFleetReconciler', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tlon-fleet-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeCore(cfg: OpenClawConfig) {
    const mutateConfigFile = vi.fn(
      async (params: {
        mutate: (draft: OpenClawConfig, ctx: never) => unknown;
      }) => {
        await params.mutate(cfg, undefined as never);
        return { result: undefined } as never;
      }
    );
    return {
      core: {
        config: { current: () => cfg, mutateConfigFile } as never,
        agent: {
          resolveAgentWorkspaceDir: (_cfg: OpenClawConfig, id: string) =>
            join(dir, `workspace-${id}`),
        } as never,
      },
      mutateConfigFile,
    };
  }

  async function settle() {
    // debounceMs 0 still defers to a macrotask; drain two rounds.
    await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => setTimeout(r, 5));
  }

  it('ignores deltas until the %init snapshot arrives', async () => {
    const cfg = freshConfig();
    const { core, mutateConfigFile } = makeCore(cfg);
    const fleet = createFleetReconciler({
      core,
      defaultMoon: null,
      normalize: normalizeShip,
      debounceMs: 0,
    });
    fleet.onFact({ minted: { ship: MOON_A, bot: botA } });
    await settle();
    expect(mutateConfigFile).not.toHaveBeenCalled();

    fleet.onFact(initFact());
    await settle();
    expect(mutateConfigFile).toHaveBeenCalledTimes(1);
    const anyCfg = cfg as unknown as AnyCfg;
    expect(anyCfg.channels.tlon.accounts?.[ACCT_A]).toBeDefined();
    expect(
      readFileSync(join(dir, `workspace-${ACCT_A}`, 'SOUL.md'), 'utf8')
    ).toContain('You are neo.');
  });

  it('skips the config write when the fleet is already up to date', async () => {
    const cfg = freshConfig();
    const { core, mutateConfigFile } = makeCore(cfg);
    const fleet = createFleetReconciler({
      core,
      defaultMoon: null,
      normalize: normalizeShip,
      debounceMs: 0,
    });
    fleet.onFact(initFact());
    await settle();
    expect(mutateConfigFile).toHaveBeenCalledTimes(1);

    // The resubscribe snapshot changes nothing: no second write.
    fleet.onFact(initFact());
    await settle();
    expect(mutateConfigFile).toHaveBeenCalledTimes(1);

    fleet.onFact({ retired: { ship: MOON_B } });
    await settle();
    expect(mutateConfigFile).toHaveBeenCalledTimes(2);
    const anyCfg = cfg as unknown as AnyCfg;
    expect(anyCfg.channels.tlon.accounts?.[ACCT_B]).toBeUndefined();
  });
});
