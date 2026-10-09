// Jev (TypeSafe's decision model) through OpenRouter. Shape lifted from
// serverless-infra lib/sentryTriage.ts: one attempt, a deadline that races the
// whole exchange, a bounded body read, a strict parse, and a typed failure
// instead of a rejection.

export const DECISIONS_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
// the dated id `typesafe/jev-1.13` resolved to when the questions were probed
export const JEV_MODEL = 'typesafe/jev-1.13-20260917';
const DEFAULT_TIMEOUT_MS = 3000;
// real responses are 1-2 kB
const MAX_RESPONSE_BYTES = 16 * 1024;

export const AREAS = [
  'plugin_sdk',
  'channel_plugin_contract',
  'gateway_runtime',
  'config_doctor_update',
  'memory',
  'heartbeat_cron',
  'codex',
  'web_search',
  'models_providers',
  'state_db',
  'platform_node',
  'other_channel',
  'client_ui',
  'voice_media',
  'browser_computer_use',
  'other',
] as const;
export type Area = (typeof AREAS)[number];

// Code owns the split: these are the subsystems the plugin and tlawn touch.
export const OUR_AREAS: readonly Area[] = AREAS.slice(0, 11);

export const KINDS = [
  'breaking',
  'behavior_default_change',
  'fix',
  'new_capability',
  'deprecation_notice',
  'internal_or_docs',
] as const;
export type Kind = (typeof KINDS)[number];

// Question text as probed on 2026-10-08, except the client_ui clause routing
// app items there even when they mention the gateway.
export const LABEL_QUESTIONS = {
  area: {
    type: 'choice',
    instructions: {
      question:
        'Which OpenClaw subsystem does the change in `bullet` primarily touch?',
      evidence:
        'Judge from the wording of `bullet`. Pick the subsystem whose code or behaviour changes; if a change spans several, pick the one an integrator embedding OpenClaw headless with a channel plugin would be affected through.',
    },
    criteria: {
      plugin_sdk:
        'The openclaw/plugin-sdk packages and exports that plugin authors import, plugin loading, plugin manifests, plugin install or update, plugin hooks.',
      channel_plugin_contract:
        'The contract between the gateway and channel plugins: inbound message dispatch, outbound reply delivery, reply chunking, typing, reactions, media on messages, chat types, allowlists, conversation routing.',
      gateway_runtime:
        'Gateway startup, readiness, lifecycle, restarts, sessions and turns, worker scheduling, compaction, the agent runner.',
      config_doctor_update:
        'The config file schema and validation, doctor repairs and migrations, the self-update and rollback machinery, admission checks.',
      memory:
        'Memory indexing, memory search, dreaming or consolidation, active memory, memory policy, the memory files.',
      heartbeat_cron:
        'Heartbeats, cron jobs, automations, scheduled runs and their alerts.',
      codex: 'The Codex integration, Codex harness, Codex sessions and tools.',
      web_search: 'Web search providers and the brave plugin.',
      models_providers:
        'Model catalog, provider configuration, OpenRouter or other provider routing, model selection, auth profiles, pricing.',
      state_db:
        'The state or agent SQLite databases, their schema and migrations, backups and restores.',
      platform_node:
        'Node version requirements, packaging, install scripts, container images, operating-system specific behaviour of the headless gateway.',
      other_channel:
        'A specific chat channel other than a generic channel contract: Discord, Telegram, Slack, iMessage, WhatsApp, Signal, Feishu, Google Chat, webhooks for one of these.',
      client_ui:
        'The desktop app, mobile apps, Control UI, dashboard, web chat UI, files and review UI, visual polish. Items about the desktop, mobile or web app (macOS app sign-in, Cloudflare Access in the desktop app, …) belong here even when they mention the gateway.',
      voice_media:
        'Voice calls, Talk, speech, transcription, image or media understanding and generation.',
      browser_computer_use:
        'Browser automation, Computer Use, sandboxes, worktrees and local-dev tooling.',
      other:
        'Anything else: docs, licensing, contributor tooling, unrelated integrations.',
    },
  },
  affects: {
    type: 'noul',
    instructions: {
      question:
        'Does the change described in `bullet` plausibly affect the Tlon channel plugin, the host configuration tlawn writes, or how Tlon runs OpenClaw in production, as described in `plugin_profile`?',
      evidence:
        'Judge from `bullet` against `plugin_profile`. A change to a subsystem the profile says Tlon does not use (another chat channel, a desktop or mobile client, voice, browser automation, a provider Tlon does not configure) does not affect it. A change to the plugin SDK, channel plugin contract, gateway startup, config schema or doctor, memory, heartbeat, cron, codex, brave web search, OpenRouter models, state DB migrations, Node version requirements, or container/headless operation does.',
    },
    criteria: {
      true: 'The change touches something Tlon uses or configures, or changes a default or requirement Tlon relies on.',
      false:
        'The change is confined to subsystems, platforms, channels or providers Tlon does not use.',
    },
  },
  kind: {
    type: 'choice',
    instructions: {
      question:
        'What kind of change does `bullet` describe, from the point of view of an integrator who embeds OpenClaw and ships a channel plugin for it?',
      evidence: 'Judge from the wording of `bullet` only.',
    },
    criteria: {
      breaking:
        'Removes, renames or tightens something an integrator may depend on: an SDK export, a config key, a schema rule, a CLI flag, a default that now rejects previously accepted input, a runtime requirement such as the Node version, or a one-way data migration.',
      behavior_default_change:
        'Keeps the interface but changes what happens by default or how an existing feature behaves, so an integrator may see different results without changing anything.',
      fix: 'Repairs a defect; existing correct usage is unaffected except that the bug no longer happens.',
      new_capability:
        'Adds something that did not exist before and that an integrator could opt into.',
      deprecation_notice:
        'Announces a future removal or change without making it yet.',
      internal_or_docs:
        'Refactor, tests, docs, tooling, performance work with no interface or behavior change an integrator would notice.',
    },
  },
};

export interface Workaround {
  id: string;
  note: string;
}

// Question keys stay identifier-shaped; workaround ids are kebab-case.
export function addressesKey(id: string) {
  return `addresses_${id.replace(/[^A-Za-z0-9]+/g, '_')}`;
}

export function workaroundQuestions(workarounds: Workaround[]) {
  return Object.fromEntries(
    workarounds.map((workaround) => [
      addressesKey(workaround.id),
      {
        type: 'noul',
        instructions: {
          question: `Does the change described in \`bullet\` make this workaround unnecessary: ${workaround.note}?`,
          evidence:
            'Judge from the wording of `bullet`. The workaround is unnecessary only if the change fixes or natively provides what it compensates for.',
        },
        criteria: {
          true: 'The change removes the need for the workaround.',
          false: 'The workaround is still needed after this change.',
        },
      },
    ])
  );
}

export type DecisionResult =
  | { outcome: 'ok'; body: Record<string, unknown>; ms: number }
  | { outcome: 'http-error'; status: number }
  | { outcome: 'timeout' | 'invalid-response' | 'error' };

export async function decide(
  state: Record<string, unknown>,
  questions: Record<string, unknown>,
  {
    apiKey,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: { apiKey: string; fetchImpl?: typeof fetch; timeoutMs?: number }
): Promise<DecisionResult> {
  const controller = new AbortController();
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<DecisionResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ outcome: 'timeout' });
    }, timeoutMs);
  });

  const exchange = (async (): Promise<DecisionResult> => {
    const response = await fetchImpl(DECISIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: controller.signal,
    });
    if (response.status !== 200) {
      response.body?.cancel().catch(() => undefined);
      return { outcome: 'http-error', status: response.status };
    }
    const text = await readBounded(response, MAX_RESPONSE_BYTES);
    let body: unknown;
    try {
      body = text === undefined ? undefined : JSON.parse(text);
    } catch {
      body = undefined;
    }
    if (!isRecord(body)) {
      return { outcome: 'invalid-response' };
    }
    return { outcome: 'ok', body, ms: Date.now() - started };
  })().catch((): DecisionResult => ({ outcome: 'error' }));

  try {
    return await Promise.race([exchange, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export interface Label {
  area: Area;
  area_probs: Record<Area, number>;
  kind: Kind;
  kind_p: number;
  kind_probs: Record<Kind, number>;
  affects: number;
}

export function parseLabel(body: Record<string, unknown>): Label | undefined {
  const answers = isRecord(body.answers) ? body.answers : undefined;
  const area = parseChoice(answers?.area, AREAS);
  const kind = parseChoice(answers?.kind, KINDS);
  const affects = parseNoul(answers?.affects);
  if (!area || !kind || affects === undefined) {
    return undefined;
  }
  return {
    area: area.choice,
    area_probs: area.probabilities,
    kind: kind.choice,
    kind_p: kind.probabilities[kind.choice],
    kind_probs: kind.probabilities,
    affects,
  };
}

export function parseAddresses(
  body: Record<string, unknown>,
  workarounds: Workaround[]
) {
  const answers = isRecord(body.answers) ? body.answers : undefined;
  const addresses: Record<string, number> = {};
  for (const workaround of workarounds) {
    const p = parseNoul(answers?.[addressesKey(workaround.id)]);
    if (p === undefined) {
      return undefined;
    }
    addresses[workaround.id] = p;
  }
  return addresses;
}

function parseChoice<T extends string>(answer: unknown, options: readonly T[]) {
  if (!isRecord(answer) || !isRecord(answer.probabilities)) {
    return undefined;
  }
  const choice = answer.choice;
  if (!(options as readonly unknown[]).includes(choice)) {
    return undefined;
  }
  // only the option names are read, so extra keys never travel further
  const probabilities = {} as Record<T, number>;
  let sum = 0;
  for (const option of options) {
    const p = answer.probabilities[option];
    if (!isProbability(p)) {
      return undefined;
    }
    probabilities[option] = p;
    sum += p;
  }
  // real answers sum to 0.99-1.00; anything far off is not a distribution and
  // the thresholds would mean nothing on it
  if (sum < 0.95 || sum > 1.05) {
    return undefined;
  }
  return { choice: choice as T, probabilities };
}

function parseNoul(answer: unknown) {
  if (!isRecord(answer) || !isProbability(answer.noul)) {
    return undefined;
  }
  return answer.noul;
}

function isProbability(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

export function costOf(body: Record<string, unknown>) {
  const cost = isRecord(body.usage) ? body.usage.cost : undefined;
  return typeof cost === 'number' && Number.isFinite(cost) ? cost : 0;
}

async function readBounded(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return undefined;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > limit) {
      reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
