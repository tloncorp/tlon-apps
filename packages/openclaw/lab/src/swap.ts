import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCheckpoint } from './checkpoint.js';
import { type LabConfig, RUNS_DIR } from './config.js';
import { buildSystemPrompt } from './context.js';
import {
  type ChatMessage,
  type ChatTool,
  type CostMeter,
  chat,
} from './openrouter.js';
import type { ModelExchange } from './real/proxy.js';
import { isCronExchange } from './real/runner.js';
import { STYLE, escape } from './report.js';
import { loadRunSet } from './store.js';
import { labTools } from './tools.js';

// The swap test: take moments where the real bot decided what to do, resend
// exactly that history, and swap in the fast lab's system prompt, tools, or
// both. Same history, same model, many samples: whatever changes in what the
// bot does next is caused by the swapped part, not by the simulated person.

type Condition = 'real' | 'fast prompt' | 'fast tools' | 'fast both';
const CONDITIONS: Condition[] = [
  'real',
  'fast prompt',
  'fast tools',
  'fast both',
];

type Request = {
  messages: { role: string; content: unknown }[];
  tools?: ChatTool[];
  reasoning?: Record<string, unknown>;
};

/** What the bot did first: which tool, or text, or nothing. */
export function action(reply: {
  content: string | null;
  toolCalls: { function: { name: string; arguments: string } }[];
}) {
  const call = reply.toolCalls[0];
  if (call) {
    if (call.function.name === 'read') {
      const target =
        /"path"\s*:\s*"([^"]+)"/.exec(call.function.arguments)?.[1] ?? '';
      return `read ${target.split('/').slice(-2).join('/')}`;
    }
    if (call.function.name === 'tlon') {
      const command =
        /"command"\s*:\s*"([^"]+)"/.exec(call.function.arguments)?.[1] ?? '';
      return `tlon ${command.split(/\s+/).slice(0, 2).join(' ')}`;
    }
    return call.function.name;
  }
  const text = reply.content?.trim() ?? '';
  return !text || text === 'NO_REPLY' ? 'silent' : 'text';
}

function distribution(actions: string[]) {
  const counts = new Map<string, number>();
  for (const a of actions) counts.set(a, (counts.get(a) ?? 0) + 1);
  return counts;
}

/** Share of samples that would have to change to match the other side. */
function distance(a: string[], b: string[]) {
  const da = distribution(a);
  const db = distribution(b);
  const keys = new Set([...da.keys(), ...db.keys()]);
  let total = 0;
  for (const key of keys) {
    total += Math.abs(
      (da.get(key) ?? 0) / a.length - (db.get(key) ?? 0) / b.length
    );
  }
  return total / 2;
}

type Point = {
  persona: string;
  owner: string;
  observed: string;
  samples: Record<Condition, string[]>;
};

export async function swapTest(input: {
  realDir: string;
  config: LabConfig;
  samples: number;
  maxPoints: number;
  concurrency: number;
}) {
  const set = loadRunSet(input.realDir);
  const checkpoint = loadCheckpoint(input.realDir, set.manifest);
  if (!checkpoint) throw new Error('run set has no prompt checkpoint');
  const meter: CostMeter = { usd: 0 };
  const fastTools = labTools({ search: set.manifest.search !== false }).map(
    ({ guidelines: _guidelines, ...tool }) => tool
  );
  const points: {
    persona: string;
    timezone: string;
    exchange: ModelExchange;
  }[] = [];
  for (const run of set.runs) {
    const file = path.join(
      input.realDir,
      `${run.persona.id}.${run.repeat}.model.json`
    );
    if (!existsSync(file)) continue;
    const exchanges = (
      JSON.parse(readFileSync(file, 'utf8')) as ModelExchange[]
    ).filter((exchange) => !isCronExchange(exchange) && exchange.response);
    for (const exchange of exchanges) {
      const messages = (exchange.request as Request).messages;
      // A decision point: the model's first call after the owner spoke.
      const last = messages.filter((m) => m.role !== 'system').at(-1);
      if (last?.role === 'user') {
        points.push({
          persona: run.persona.id,
          timezone: run.persona.timezone ?? 'America/New_York',
          exchange,
        });
      }
    }
  }
  const chosen = points.slice(0, input.maxPoints);
  const jobs = chosen.flatMap((point, index) =>
    CONDITIONS.flatMap((condition) =>
      Array.from({ length: input.samples }, () => ({ index, point, condition }))
    )
  );
  const results: Point[] = chosen.map(({ persona, exchange }) => {
    const messages = (exchange.request as Request).messages;
    const ownerMessage =
      messages.filter((m) => m.role === 'user').at(-2) ?? messages.at(-1);
    const owner = String(
      typeof ownerMessage?.content === 'string' ? ownerMessage.content : ''
    );
    return {
      persona,
      owner:
        /\[Current owner message\]\n([\s\S]*?)(\n\[|$)/.exec(owner)?.[1] ??
        owner.slice(0, 300),
      observed: action(exchange.response!),
      samples: {
        real: [],
        'fast prompt': [],
        'fast tools': [],
        'fast both': [],
      },
    };
  });
  let next = 0;
  await Promise.all(
    Array.from({ length: input.concurrency }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const request = job.point.exchange.request as Request;
        const swapPrompt =
          job.condition === 'fast prompt' || job.condition === 'fast both';
        const swapTools =
          job.condition === 'fast tools' || job.condition === 'fast both';
        const messages = request.messages.map((message) =>
          swapPrompt &&
          (message.role === 'system' || message.role === 'developer')
            ? {
                role: 'system',
                content: buildSystemPrompt({
                  sources: checkpoint.sources,
                  tools: labTools({ search: set.manifest.search !== false }),
                  botModel: set.manifest.models.bot,
                  timezone: job.point.timezone,
                }),
              }
            : message
        ) as ChatMessage[];
        try {
          const reply = await chat({
            key: input.config.openrouterKey,
            model: set.manifest.models.bot,
            messages,
            tools: swapTools ? fastTools : request.tools,
            ...(request.reasoning ? { reasoning: request.reasoning } : {}),
            maxTokens: 16_000,
            meter,
          });
          results[job.index].samples[job.condition].push(action(reply));
        } catch (error) {
          results[job.index].samples[job.condition].push(
            `error: ${error instanceof Error ? error.message.slice(0, 60) : String(error)}`
          );
        }
      }
    })
  );
  return { results, costUsd: meter.usd, label: set.manifest.label };
}

export function renderSwapReport(input: {
  results: Point[];
  costUsd: number;
  label: string;
  samples: number;
}) {
  const noise =
    input.results
      .map((point) => {
        const half = Math.floor(point.samples.real.length / 2);
        return distance(
          point.samples.real.slice(0, half),
          point.samples.real.slice(half)
        );
      })
      .reduce((a, b) => a + b, 0) / Math.max(input.results.length, 1);
  const summary =
    `<tr><td>nothing (real resampled against itself)</td><td class="num">${Math.round(noise * 100)}%</td></tr>` +
    CONDITIONS.slice(1)
      .map((condition) => {
        const d = input.results.map((point) =>
          distance(point.samples.real, point.samples[condition])
        );
        const avg = d.reduce((a, b) => a + b, 0) / Math.max(d.length, 1);
        return `<tr><td>${condition}</td><td class="num">${Math.round(avg * 100)}%</td></tr>`;
      })
      .join('');
  const cell = (actions: string[]) =>
    [...distribution(actions).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => `<code>${escape(name)}</code>×${n}`)
      .join('<br>');
  const rows = input.results
    .map(
      (point) =>
        `<tr><td>${escape(point.persona)}<span class="sub">${escape(point.owner.slice(0, 140))}</span></td><td><code>${escape(point.observed)}</code></td>${CONDITIONS.map((c) => `<td>${cell(point.samples[c])}</td>`).join('')}</tr>`
    )
    .join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Swap test</title><style>${STYLE} code{font-size:12px}</style></head><body><main>
  <h1>Swap test</h1>
  <p class="muted">${escape(input.label)}: ${input.results.length} moments where the real bot chose its next step, each resent ${input.samples}× per condition with the same history. $${input.costUsd.toFixed(2)}.</p>
  <h2>How much each swap moves the bot</h2>
  <p class="muted">Average share of the bot's next steps that differ from the real setup's. The first row is the noise floor: the real setup's own samples split in two halves.</p>
  <table><tr><th>Swapped in from the fast lab</th><th>Differs from real</th></tr>${summary}</table>
  <h2>Each moment</h2>
  <table><tr><th>Moment</th><th>What the real bot did</th>${CONDITIONS.map((c) => `<th>${c}</th>`).join('')}</tr>${rows}</table>
  </main></body></html>`;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const file = path.join(RUNS_DIR, `swap-${stamp}.html`);
  writeFileSync(file, html);
  writeFileSync(
    file.replace(/\.html$/, '.json'),
    JSON.stringify(input.results, null, 2)
  );
  return file;
}
