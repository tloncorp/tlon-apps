/**
 * Roster→config fleet reconciler.
 *
 * One tlon account (identity carrier: inherits the host creds, adds the
 * bot's moon), one agent (the brains: model + persona via a per-bot
 * workspace), and one binding per steward-roster bot. The default account's
 * monitor feeds every /v1/roster fact into a reconciler that recomputes the
 * desired fleet and persists it through the runtime's config-mutation API;
 * the gateway's config hot reload applies it (2026.9.2+ applies agent and
 * binding edits live, and channel-account changes reload only the tlon
 * channel runtime). This replaces the old model where the fleet was
 * generated once at boot by the container entrypoint and every roster
 * change restarted the whole gateway.
 *
 * Ownership rule: an account entry is fleet-managed iff its id is the
 * moon's @p without the leading sigil and its `moon` field points back at
 * that moon. Steward's roster is authoritative for entries shaped that way
 * — a mint upserts them, a retire removes them — while anything else in
 * the config (hand-written accounts, non-tlon bindings, other agents) is
 * never touched.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OpenClawConfig, PluginRuntime } from 'openclaw/plugin-sdk/core';

/** JSON shape of steward-roster-update-1 facts over the HTTP channel. */
export type RosterBotJson = {
  nickname?: unknown;
  avatar?: unknown;
  model?: unknown;
  harness?: unknown;
  persona?: unknown;
  created?: unknown;
};
export type RosterFact = {
  init?: Record<string, RosterBotJson>;
  minted?: { ship?: string; bot?: RosterBotJson };
  configured?: { ship?: string; bot?: RosterBotJson };
  retired?: { ship?: string };
};

export type RosterBot = {
  nickname: string;
  avatar: string | null;
  model: string | null;
  harness: string;
  persona: string;
};
/** Keyed by normalized moon @p (with sigil). */
export type Roster = Map<string, RosterBot>;

function toRosterBot(json: RosterBotJson | undefined): RosterBot {
  return {
    nickname: typeof json?.nickname === 'string' ? json.nickname : '',
    avatar:
      typeof json?.avatar === 'string' && json.avatar.length > 0
        ? json.avatar
        : null,
    model:
      typeof json?.model === 'string' && json.model.length > 0
        ? json.model
        : null,
    harness: typeof json?.harness === 'string' ? json.harness : '',
    persona: typeof json?.persona === 'string' ? json.persona : '',
  };
}

/**
 * Folds one roster fact into the local roster. %init (sent on every new
 * subscription, including SSE reconnects) replaces the whole map, so the
 * local copy self-heals across connection gaps.
 */
export function applyRosterFact(
  roster: Roster,
  fact: RosterFact,
  normalize: (ship: string) => string
): Roster {
  if (fact?.init && typeof fact.init === 'object') {
    const next: Roster = new Map();
    for (const [ship, bot] of Object.entries(fact.init)) {
      next.set(normalize(ship), toRosterBot(bot));
    }
    return next;
  }
  const next = new Map(roster);
  for (const key of ['minted', 'configured'] as const) {
    const ship = fact?.[key]?.ship;
    if (typeof ship === 'string' && ship.length > 0) {
      next.set(normalize(ship), toRosterBot(fact[key]?.bot));
    }
  }
  const retired = fact?.retired?.ship;
  if (typeof retired === 'string' && retired.length > 0) {
    next.delete(normalize(retired));
  }
  return next;
}

export type FleetAgentDesired = {
  /** Account id, agent id, and binding account: the moon @p sans sigil. */
  acct: string;
  moon: string;
  nickname: string;
  avatar: string | null;
  model: string | null;
  persona: string;
};

/**
 * The fleet the config should describe. The default account's moon (when
 * configured) is skipped: that bot already runs as the default account. A
 * bot the roster assigns to another harness is not ours to run: skipping it
 * here also removes its fleet slice if we ran it before the reassignment.
 * The mint default is 'openclaw', and an empty harness means the same.
 */
export function computeFleetAgents(
  roster: Roster,
  defaultMoon: string | null
): FleetAgentDesired[] {
  const out: FleetAgentDesired[] = [];
  for (const [moon, bot] of roster) {
    if (defaultMoon && moon === defaultMoon) {
      continue;
    }
    if (bot.harness !== '' && bot.harness !== 'openclaw') {
      continue;
    }
    const { harness: _harness, ...rest } = bot;
    out.push({ acct: moon.replace(/^~/, ''), moon, ...rest });
  }
  return out.sort((a, b) => (a.acct < b.acct ? -1 : a.acct > b.acct ? 1 : 0));
}

type AccountEntry = { moon?: unknown; [k: string]: unknown };
type AgentEntry = {
  identity?: { name?: unknown; [k: string]: unknown };
  model?: unknown;
  [k: string]: unknown;
};
type Binding = {
  agentId?: unknown;
  match?: { channel?: unknown; accountId?: unknown; [k: string]: unknown };
  [k: string]: unknown;
};

function isFleetManagedAccount(
  id: string,
  entry: AccountEntry | undefined,
  normalize: (ship: string) => string
): boolean {
  return typeof entry?.moon === 'string' && normalize(entry.moon) === `~${id}`;
}

/**
 * Rewrites the fleet-managed slice of the config in place (the mutate
 * callback for `config.mutateConfigFile`). Non-fleet entries, extra fields
 * an operator added to a fleet account, and the (operator-owned, additive)
 * model allowlist are preserved.
 */
export function applyFleetToConfig(
  draft: OpenClawConfig,
  desired: FleetAgentDesired[],
  normalize: (ship: string) => string
): void {
  const cfg = draft as unknown as {
    channels?: { tlon?: { accounts?: Record<string, AccountEntry> } };
    agents?: {
      defaults?: { models?: Record<string, unknown> };
      entries?: Record<string, AgentEntry>;
    };
    bindings?: Binding[];
  };
  const tlon = cfg.channels?.tlon;
  if (!tlon) {
    return;
  }
  const desiredById = new Map(desired.map((d) => [d.acct, d]));

  const accounts = (tlon.accounts ??= {});
  for (const [id, entry] of Object.entries(accounts)) {
    if (isFleetManagedAccount(id, entry, normalize) && !desiredById.has(id)) {
      delete accounts[id];
    }
  }
  for (const d of desired) {
    const existing = accounts[d.acct];
    accounts[d.acct] = {
      ...existing,
      // An operator's explicit disable survives reconciles; retiring is
      // steward's job, pausing is the operator's.
      enabled: existing?.enabled !== false,
      // Fleet accounts default owner-listen off: with several bots, each
      // default-enabled one would answer the owner's untargeted messages,
      // once per bot. Seeded at creation only, so an operator's explicit
      // opt-in survives reconciles.
      ...(existing === undefined ? { ownerListenEnabled: false } : {}),
      moon: d.moon,
      moonNickname: d.nickname,
      ...(d.avatar ? { moonAvatar: d.avatar } : {}),
    };
    if (!d.avatar) {
      delete accounts[d.acct].moonAvatar;
    }
  }

  const agents = (cfg.agents ??= {});
  const entries = (agents.entries ??= {});
  for (const id of Object.keys(entries)) {
    if (desiredById.has(id)) {
      continue;
    }
    const account = accounts[id];
    // With the account upserted/removed above, a fleet agent either has a
    // fleet-managed account (live bot) or a moon-shaped id with no account
    // left (just-retired bot).
    const managed = account
      ? isFleetManagedAccount(id, account, normalize)
      : isMoonShapedId(id);
    if (managed) {
      delete entries[id];
    }
  }
  // Adding entries changes how the gateway resolves its default agent: with
  // no entries at all it falls back to the implicit `main` agent, and with
  // exactly one entry that entry is the default. Fleet entries would
  // otherwise erase both resolutions, orphaning the default account's bot.
  // Pin the pre-fleet default with an explicit marker before adding ours.
  // (At this point `entries` holds only non-fleet entries.) Several unmarked
  // pre-existing entries were already unresolvable before the fleet arrived;
  // that stays `openclaw doctor`'s problem.
  if (
    desired.length > 0 &&
    (agents as { ownership?: unknown }).ownership !== 'explicit' &&
    !Object.values(entries).some(
      (e) => (e as { default?: unknown })?.default === true
    )
  ) {
    const ids = Object.keys(entries);
    if (ids.length === 0) {
      // The implicit agent openclaw resolves when agents.entries is absent.
      entries.main = { default: true };
    } else if (ids.length === 1) {
      entries[ids[0]] = { ...entries[ids[0]], default: true };
    }
  }
  for (const d of desired) {
    const existing = entries[d.acct];
    const next: AgentEntry = {
      ...existing,
      identity: { ...existing?.identity, name: d.nickname },
    };
    if (d.model) {
      next.model =
        typeof existing?.model === 'object' && existing.model !== null
          ? { ...existing.model, primary: d.model }
          : { primary: d.model };
    } else if (typeof next.model === 'object' && next.model !== null) {
      // The roster reverted this bot to the gateway default: drop the
      // primary the fleet set, or the old override would win forever.
      const { primary: _primary, ...rest } = next.model as {
        primary?: unknown;
      };
      if (Object.keys(rest).length > 0) {
        next.model = rest;
      } else {
        delete next.model;
      }
    }
    entries[d.acct] = next;
  }

  const models = ((agents.defaults ??= {}).models ??= {});
  for (const d of desired) {
    if (d.model && !(d.model in models)) {
      models[d.model] = {};
    }
  }

  const bindings = (cfg.bindings ??= []);
  const keep = bindings.filter((b) => {
    if (b?.match?.channel !== 'tlon') {
      return true;
    }
    const accountId = b.match.accountId;
    if (typeof accountId !== 'string' || accountId.length === 0) {
      return true;
    }
    const managed = accounts[accountId]
      ? isFleetManagedAccount(accountId, accounts[accountId], normalize)
      : b.agentId === accountId && isMoonShapedId(accountId);
    return !managed || desiredById.has(accountId);
  });
  for (const d of desired) {
    const exists = keep.some(
      (b) =>
        b?.agentId === d.acct &&
        b?.match?.channel === 'tlon' &&
        b?.match?.accountId === d.acct
    );
    if (!exists) {
      keep.push({
        agentId: d.acct,
        match: { channel: 'tlon', accountId: d.acct },
      });
    }
  }
  cfg.bindings = keep;
}

/** A plausible moon @p body: four or more syllable pairs, sigil stripped. */
function isMoonShapedId(id: string): boolean {
  return /^([a-z]{6}-){3,7}[a-z]{6}$/.test(id);
}

/** True when a reconcile write would not change the config. */
export function fleetConfigUpToDate(
  cfg: OpenClawConfig,
  desired: FleetAgentDesired[],
  normalize: (ship: string) => string
): boolean {
  const slice = (c: OpenClawConfig) => {
    const anyCfg = c as unknown as Record<string, any>;
    return {
      accounts: anyCfg.channels?.tlon?.accounts ?? {},
      entries: anyCfg.agents?.entries ?? {},
      models: anyCfg.agents?.defaults?.models ?? {},
      bindings: anyCfg.bindings ?? [],
    };
  };
  const before = JSON.stringify(slice(cfg));
  const clone = JSON.parse(JSON.stringify(slice(cfg))) as Record<
    string,
    unknown
  >;
  const probe = {
    channels: { tlon: { accounts: clone.accounts } },
    agents: { entries: clone.entries, defaults: { models: clone.models } },
    bindings: clone.bindings,
  } as unknown as OpenClawConfig;
  applyFleetToConfig(probe, desired, normalize);
  return JSON.stringify(slice(probe)) === before;
}

/**
 * Seeds the per-bot persona files; returns true when anything was written.
 * Seed-only: once a file exists the workspace owns it — the owner edits it
 * through the steward prompts flow, and rewriting it from the roster here
 * would silently revert those edits on the next roster fact.
 */
export async function ensureBotWorkspace(params: {
  dir: string;
  moon: string;
  nickname: string;
  persona: string;
}): Promise<boolean> {
  const soul = `# SOUL\n\nYou are ${params.nickname}.\n\n${params.persona}\n`;
  const identity = `# IDENTITY\n\nName: ${params.nickname}\nShip: ${params.moon}\n`;
  await mkdir(params.dir, { recursive: true });
  let changed = false;
  for (const [name, content] of [
    ['SOUL.md', soul],
    ['IDENTITY.md', identity],
  ] as const) {
    const path = join(params.dir, name);
    const current = await readFile(path, 'utf8').catch(() => null);
    if (current === null) {
      await writeFile(path, content, 'utf8');
      changed = true;
    }
  }
  return changed;
}

export type FleetReconciler = {
  /** Feed one /v1/roster fact; reconciliation is debounced and serialized. */
  onFact: (fact: RosterFact) => void;
};

export function createFleetReconciler(params: {
  core: Pick<PluginRuntime, 'config' | 'agent'>;
  defaultMoon: string | null;
  normalize: (ship: string) => string;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
  /** Debounce for fact bursts (an %init right after subscribe, say). */
  debounceMs?: number;
}): FleetReconciler {
  const { core, defaultMoon, normalize } = params;
  const debounceMs = params.debounceMs ?? 500;
  let roster: Roster = new Map();
  let sawInit = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let dirty = false;

  async function reconcile(): Promise<void> {
    const desired = computeFleetAgents(roster, defaultMoon);
    const cfg = core.config.current() as OpenClawConfig;
    for (const d of desired) {
      const dir = core.agent.resolveAgentWorkspaceDir(cfg, d.acct);
      const changed = await ensureBotWorkspace({
        dir,
        moon: d.moon,
        nickname: d.nickname,
        persona: d.persona,
      });
      if (changed) {
        params.log?.(
          `[tlon] Fleet: wrote workspace for ${d.nickname} (${d.moon})`
        );
      }
    }
    if (fleetConfigUpToDate(cfg, desired, normalize)) {
      return;
    }
    await core.config.mutateConfigFile({
      afterWrite: { mode: 'auto' },
      mutate: (draft) => applyFleetToConfig(draft, desired, normalize),
    });
    params.log?.(
      `[tlon] Fleet reconciled from roster (${desired.length} bot agent(s)); config hot reload applies it`
    );
  }

  async function run(): Promise<void> {
    if (running) {
      dirty = true;
      return;
    }
    running = true;
    try {
      do {
        dirty = false;
        await reconcile();
      } while (dirty);
    } catch (error) {
      params.error?.(`[tlon] Fleet reconcile failed: ${String(error)}`);
    } finally {
      running = false;
    }
  }

  return {
    onFact(fact: RosterFact) {
      if (fact?.init && typeof fact.init === 'object') {
        sawInit = true;
      }
      roster = applyRosterFact(roster, fact, normalize);
      if (!sawInit) {
        // A delta before the snapshot would reconcile against a partial
        // roster and retire every bot the snapshot hasn't delivered yet.
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, debounceMs);
    },
  };
}
