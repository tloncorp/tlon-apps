import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCheckpoint } from './checkpoint.js';
import {
  buildOwnerMessage,
  buildSystemPrompt,
  runtimeContextMessage,
  templatedOwnerMessage,
} from './context.js';
import { fillSystem } from './template.js';
import type { ModelExchange } from './real/proxy.js';
import { isCronExchange } from './real/runner.js';
import { STYLE, escape, renderChat } from './report.js';
import { RUNS_DIR } from './config.js';
import { frozenTemplate, loadRunSet } from './store.js';
import { labTools } from './tools.js';
import type { RunRecord, RunSetManifest } from './types.js';

// How far the fast lab is from the real sandbox: what the model is sent
// (exact, from captured requests), and what the bot then does (statistics
// over runs of the same personas in both modes).

type Set = { dir: string; manifest: RunSetManifest; runs: RunRecord[] };

const text = (content: unknown): string =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part) => (part as { text?: string }).text ?? '').join('')
      : '';

function headers(prompt: string) {
  return [...prompt.matchAll(/^## (.+)$/gm)]
    .map((match) => match[1].trim())
    .map((header) => header.replace(/^\/.*\/([^/]+)$/, '$1'));
}

function skills(prompt: string) {
  return [...prompt.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]);
}

function injectedFiles(prompt: string) {
  const section = prompt.split('# Project Context')[1] ?? '';
  return [...section.matchAll(/^## (?:.*\/)?([A-Z]+\.md)$/gm)].map((m) => m[1]);
}

type Tool = {
  function: { name: string; description?: string; parameters?: unknown };
};

function paramNames(tool: Tool | undefined) {
  const properties = (tool?.function.parameters as { properties?: object })
    ?.properties;
  return Object.keys(properties ?? {}).sort();
}

function setOf(values: string[]) {
  return new Set(values);
}

function onlyIn(a: string[], b: string[]) {
  const other = setOf(b);
  return a.filter((value) => !other.has(value));
}

function list(values: string[]) {
  return values.length
    ? values.map((value) => `<code>${escape(value)}</code>`).join(' ')
    : '<span class="muted">none</span>';
}

/** The first conversation request of a real run, as OpenClaw sent it. */
function firstRealRequest(set: Set) {
  for (const run of set.runs) {
    const file = path.join(
      set.dir,
      `${run.persona.id}.${run.repeat}.model.json`
    );
    if (!existsSync(file)) continue;
    const exchanges = JSON.parse(readFileSync(file, 'utf8')) as ModelExchange[];
    const first = exchanges.find((exchange) => !isCronExchange(exchange));
    if (first) return { run, exchange: first, exchanges };
  }
  return undefined;
}

/** What the fast lab sends at the same moment, rebuilt from its own code. */
function fastRequest(fast: Set, run: RunRecord, ownerText: string) {
  const checkpoint = loadCheckpoint(fast.dir, fast.manifest);
  if (!checkpoint) throw new Error(`${fast.dir} has no prompt checkpoint`);
  const template = frozenTemplate(fast.dir);
  const tools = labTools({ search: fast.manifest.search !== false, template });
  const timezone = run.persona.timezone ?? 'America/New_York';
  const settings = {
    model: fast.manifest.models.bot,
    reasoning: template?.settings.reasoning
      ? JSON.stringify(template.settings.reasoning)
      : (fast.manifest.deployment?.agent?.thinkingDefault ?? 'unset'),
    max_tokens: '6000 (retried up to 32000 when cut off)',
    stream: false,
  };
  if (template) {
    return {
      system: fillSystem(template.system, template, checkpoint.sources, {
        sessionId: 'fast',
      }),
      owner: templatedOwnerMessage({
        template,
        text: ownerText,
        onboardingActive: true,
        timezone,
        now: new Date(),
      }),
      runtime: runtimeContextMessage(template, 'fast'),
      tools: tools as Tool[],
      settings,
    };
  }
  return {
    system: buildSystemPrompt({
      sources: checkpoint.sources,
      tools,
      botModel: fast.manifest.models.bot,
      timezone,
    }),
    owner: buildOwnerMessage({
      text: ownerText,
      onboardingActive: true,
      timezone,
    }),
    runtime: undefined,
    tools: tools as Tool[],
    settings,
  };
}

function requestSection(fast: Set, real: Set) {
  const captured = firstRealRequest(real);
  if (!captured) return '<p class="muted">No captured real requests.</p>';
  const request = captured.exchange.request as {
    messages: { role: string; content: unknown }[];
    tools?: Tool[];
    [key: string]: unknown;
  };
  const system = text(
    request.messages.find((m) => m.role === 'system' || m.role === 'developer')
      ?.content
  );
  const users = request.messages
    .filter((m) => m.role === 'user')
    .map((m) => text(m.content));
  const ownerText =
    captured.run.transcript.find((e) => e.from === 'user' && 'text' in e)?.[
      'text' as never
    ] ?? '';
  const f = fastRequest(fast, captured.run, String(ownerText));
  const realTools = (request.tools ?? []) as Tool[];
  const realNames = realTools.map((t) => t.function.name).sort();
  const fastNames = f.tools.map((t) => t.function.name).sort();
  const shared = realNames.filter((name) => fastNames.includes(name));
  const toolRows = shared
    .map((name) => {
      const r = realTools.find((t) => t.function.name === name);
      const l = f.tools.find((t) => t.function.name === name);
      const sameDescription =
        r?.function.description === l?.function.description;
      const rp = paramNames(r);
      const lp = paramNames(l);
      return `<tr><td><code>${escape(name)}</code></td><td>${sameDescription ? 'same' : `<b>differs</b> (${r?.function.description?.length ?? 0} vs ${l?.function.description?.length ?? 0} chars)`}</td><td>${JSON.stringify(rp) === JSON.stringify(lp) ? 'same' : `real ${list(rp)}<br>fast ${list(lp)}`}</td></tr>`;
    })
    .join('');
  const realHeaders = headers(system);
  const fastHeaders = headers(f.system);
  const settings = Object.entries({
    model: [request.model, f.settings.model],
    reasoning: [
      JSON.stringify(request.reasoning ?? 'unset'),
      f.settings.reasoning,
    ],
    'max tokens': [
      String(request.max_completion_tokens ?? request.max_tokens ?? 'unset'),
      f.settings.max_tokens,
    ],
    provider: [JSON.stringify(request.provider ?? 'unset'), 'unset'],
    temperature: [String(request.temperature ?? 'unset'), 'unset'],
    stream: [String(request.stream ?? false), String(f.settings.stream)],
  })
    .map(
      ([key, [r, l]]) =>
        `<tr><td>${key}</td><td>${escape(String(r))}</td><td>${escape(String(l))}</td></tr>`
    )
    .join('');
  return `
  <h2>What the model is sent</h2>
  <p class="muted">The first request of ${escape(captured.run.persona.id)}'s real run, against what the fast lab builds for the same moment.</p>
  <h3>Request settings</h3>
  <table><tr><th></th><th>Real</th><th>Fast</th></tr>${settings}</table>
  <h3>System prompt</h3>
  <table>
    <tr><th></th><th>Real</th><th>Fast</th></tr>
    <tr><td>Characters</td><td>${system.length.toLocaleString()}</td><td>${f.system.length.toLocaleString()}</td></tr>
    <tr><td>Sections only here</td><td>${list(onlyIn(realHeaders, fastHeaders))}</td><td>${list(onlyIn(fastHeaders, realHeaders))}</td></tr>
    <tr><td>Workspace files, in order</td><td>${list(injectedFiles(system))}</td><td>${list(injectedFiles(f.system))}</td></tr>
    <tr><td>Skills listed only here</td><td>${list(onlyIn(skills(system), skills(f.system)))}</td><td>${list(onlyIn(skills(f.system), skills(system)))}</td></tr>
  </table>
  <h3>Tools</h3>
  <table>
    <tr><th></th><th>Real</th><th>Fast</th></tr>
    <tr><td>Count</td><td>${realNames.length}</td><td>${fastNames.length}</td></tr>
    <tr><td>Only here</td><td>${list(onlyIn(realNames, fastNames))}</td><td>${list(onlyIn(fastNames, realNames))}</td></tr>
  </table>
  <table><tr><th>Shared tool</th><th>Description</th><th>Parameters</th></tr>${toolRows}</table>
  <h3>The owner's first message</h3>
  <div class="row2"><div><b>Real</b> (${users.length} user messages)${users.map((u) => `<pre>${escape(u)}</pre>`).join('')}</div>
  <div><b>Fast</b><pre>${escape(f.owner)}</pre>${f.runtime ? `<pre>${escape(f.runtime)}</pre>` : ''}</div></div>`;
}

type Numbers = Record<string, number | null>;

function mean(values: number[]) {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

function rate(values: boolean[]) {
  return values.length ? values.filter(Boolean).length / values.length : null;
}

/** The behaviour numbers compared across modes. */
export function behaviour(runs: RunRecord[]): Numbers {
  const ok = runs.filter((run) => !run.error);
  const count = (predicate: (run: RunRecord) => number) =>
    mean(ok.map(predicate));
  const tool = (name: string) =>
    count(
      (run) =>
        run.turns
          .flatMap((turn) => turn.toolCalls)
          .filter((c) => c.name === name).length
    );
  const firstMove = (kind: string) =>
    rate(
      ok.map((run) => {
        const turn = run.turns.find((t) =>
          t.events.some((e) => e.from === 'bot')
        );
        const event = turn?.events.find(
          (e) => e.from === 'bot' && e.kind !== 'suppressed'
        );
        return event?.kind === kind;
      })
    );
  return {
    runs: ok.length,
    'plan made': rate(ok.map((run) => run.facts.planCreated)),
    'owner messages before the end': count((run) => run.facts.userTurns),
    'choice cards': count((run) => run.facts.choicesPosted),
    'bot text messages': count((run) => run.facts.botTextMessages),
    'silent turns': count((run) => run.facts.silentTurns),
    'first reply is a choice card': firstMove('choice'),
    'first reply is text': firstMove('text'),
    'first reply is a plan': firstMove('plan'),
    'person left': rate(ok.map((run) => run.facts.ending === 'user-left')),
    'first result ok': rate(
      ok
        .filter((run) => run.facts.firstResultOk !== null)
        .map((run) => Boolean(run.facts.firstResultOk))
    ),
    'would come back': rate(
      ok.filter((run) => run.keep).map((run) => run.keep!.keep)
    ),
    'tool calls per run': count(
      (run) => run.turns.flatMap((t) => t.toolCalls).length
    ),
    'read calls': tool('read'),
    'tlon calls': tool('tlon'),
    'web calls': count(
      (run) =>
        run.turns
          .flatMap((t) => t.toolCalls)
          .filter((c) => c.name.startsWith('web_')).length
    ),
    'blocked tool calls': count((run) => run.facts.blockedToolCalls),
    'tool errors': count((run) => run.facts.toolErrors),
    'errors (runs)': runs.length - ok.length,
  };
}

function format(value: number | null, key: string) {
  if (value === null) return '—';
  if (/made|reply is|left|ok|come back/.test(key))
    return `${Math.round(value * 100)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function behaviourSection(fast: Set, real: Set) {
  const f = behaviour(fast.runs);
  const r = behaviour(real.runs);
  const rows = Object.keys(f)
    .map(
      (key) =>
        `<tr><td>${escape(key)}</td><td class="num">${format(f[key], key)}</td><td class="num">${format(r[key], key)}</td></tr>`
    )
    .join('');
  const personas = [
    ...new Set([...fast.runs, ...real.runs].map((run) => run.persona.id)),
  ];
  const personaRows = personas
    .map((id) => {
      const cells = [fast, real].map((set) =>
        set.runs
          .filter((run) => run.persona.id === id)
          .map(
            (run) =>
              `${run.facts.planCreated ? 'plan' : run.facts.ending} · ${run.facts.userTurns} msgs · ${run.facts.choicesPosted} cards${run.error ? ' · <span class="bad">error</span>' : ''}`
          )
          .join('<br>')
      );
      return `<tr><td>${escape(id)}</td><td>${cells[0] || '—'}</td><td>${cells[1] || '—'}</td></tr>`;
    })
    .join('');
  return `
  <h2>What the bot does</h2>
  <p class="muted">Means per run. Differences smaller than the spread between repeats of the same mode are noise.</p>
  <table><tr><th></th><th>Fast (${escape(fast.manifest.label)})</th><th>Real (${escape(real.manifest.label)})</th></tr>${rows}</table>
  <h3>By persona</h3>
  <table><tr><th>Persona</th><th>Fast</th><th>Real</th></tr>${personaRows}</table>
  ${noiseSection(fast, real)}`;
}

type Probe = { label: string; value: (run: RunRecord) => number | string };

const PROBES: Probe[] = [
  { label: 'made a plan', value: (run) => String(run.facts.planCreated) },
  { label: 'how it ended', value: (run) => run.facts.ending },
  {
    label: 'first reply kind',
    value: (run) =>
      run.turns
        .flatMap((turn) => turn.events)
        .find((e) => e.from === 'bot' && e.kind !== 'suppressed')?.kind ??
      'none',
  },
  { label: 'choice cards', value: (run) => run.facts.choicesPosted },
  { label: 'owner messages', value: (run) => run.facts.userTurns },
  {
    label: 'tool calls',
    value: (run) => run.turns.flatMap((turn) => turn.toolCalls).length,
  },
  { label: 'would come back', value: (run) => String(run.keep?.keep ?? '-') },
];

/** Difference between two runs: 0/1 for labels, absolute gap for counts. */
function gap(a: number | string, b: number | string) {
  return typeof a === 'number' && typeof b === 'number'
    ? Math.abs(a - b)
    : a === b
      ? 0
      : 1;
}

/**
 * Same persona, two runs: how different are they within a mode versus
 * across modes? Only the part of the cross-mode gap above the within-mode
 * gaps is a difference between fast and real.
 */
function noiseSection(fast: Set, real: Set) {
  const byPersona = (set: Set) => {
    const map = new Map<string, RunRecord[]>();
    for (const run of set.runs.filter((r) => !r.error)) {
      map.set(run.persona.id, [...(map.get(run.persona.id) ?? []), run]);
    }
    return map;
  };
  const f = byPersona(fast);
  const r = byPersona(real);
  const pairsWithin = (map: Map<string, RunRecord[]>) =>
    [...map.values()].flatMap((runs) =>
      runs.flatMap((a, i) => runs.slice(i + 1).map((b) => [a, b] as const))
    );
  const pairsAcross = [...f.entries()].flatMap(([id, runs]) =>
    runs.flatMap((a) => (r.get(id) ?? []).map((b) => [a, b] as const))
  );
  const average = (pairs: (readonly [RunRecord, RunRecord])[], probe: Probe) =>
    pairs.length
      ? pairs.reduce(
          (sum, [a, b]) => sum + gap(probe.value(a), probe.value(b)),
          0
        ) / pairs.length
      : null;
  const show = (value: number | null, probe: Probe) =>
    value === null
      ? '—'
      : typeof probe.value(fast.runs[0] ?? real.runs[0]) === 'number'
        ? value.toFixed(1)
        : `${Math.round(value * 100)}%`;
  const rows = PROBES.map((probe) => {
    const ff = average(pairsWithin(f), probe);
    const rr = average(pairsWithin(r), probe);
    const fr = average(pairsAcross, probe);
    const noise = Math.max(ff ?? 0, rr ?? 0);
    const flag =
      fr !== null && fr > noise * 1.5 && fr - noise > 0.1 ? ' <b>↑</b>' : '';
    return `<tr><td>${escape(probe.label)}</td><td class="num">${show(ff, probe)}</td><td class="num">${show(rr, probe)}</td><td class="num">${show(fr, probe)}${flag}</td></tr>`;
  }).join('');
  return `
  <h3>Same persona, different runs</h3>
  <p class="muted">How often two runs of one persona differ (labels) or by how much on average (counts). ↑ marks where fast and real differ clearly more than either mode differs from itself.</p>
  <table><tr><th></th><th>Fast vs fast</th><th>Real vs real</th><th>Fast vs real</th></tr>${rows}</table>`;
}

function transcriptsSection(fast: Set, real: Set) {
  const personas = [...new Set(real.runs.map((run) => run.persona.id))];
  return `<h2>Side by side</h2>${personas
    .map((id) => {
      const pick = (set: Set) => set.runs.find((run) => run.persona.id === id);
      const f = pick(fast);
      const r = pick(real);
      return `<details><summary><b>${escape(id)}</b></summary><div class="row2"><div><h4>Fast</h4>${f ? renderChat(f.transcript) : '—'}</div><div><h4>Real</h4>${r ? renderChat(r.transcript) : '—'}</div></div></details>`;
    })
    .join('')}`;
}

export function divergenceReport(fastDir: string, realDir: string) {
  const fast: Set = loadRunSet(fastDir);
  const real: Set = loadRunSet(realDir);
  if (real.manifest.mode !== 'real') {
    throw new Error(`${realDir} is not a real-mode run set`);
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fast vs real</title><style>${STYLE}
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 800px) { .row2 { grid-template-columns: 1fr; } }
  pre { white-space: pre-wrap; font-size: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 7px; padding: 8px; }
  code { font-size: 12px; }
  </style></head><body><main>
  <h1>Fast vs real</h1>
  <p class="muted">${escape(fast.manifest.label)} (fast, ${fast.runs.length} runs) against ${escape(real.manifest.label)} (real sandbox, ${real.runs.length} runs).</p>
  ${requestSection(fast, real)}
  ${behaviourSection(fast, real)}
  ${transcriptsSection(fast, real)}
  </main></body></html>`;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const file = path.join(RUNS_DIR, `diverge-${stamp}.html`);
  writeFileSync(file, html);
  return file;
}
