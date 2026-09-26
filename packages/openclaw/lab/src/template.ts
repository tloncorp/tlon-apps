import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { LAB_DIR, type PromptSources } from './config.js';
import type { ChatTool } from './openrouter.js';
import type { ModelExchange } from './real/proxy.js';

// A calibration template: one real request from the sandbox, with the parts a
// lab variant changes cut out as placeholders. The fast lab fills it in
// instead of imitating OpenClaw by hand, so its system prompt, tool schemas
// and message framing are OpenClaw's own until OpenClaw changes; then a real
// run recalibrates it. Workspace files are placeholders, so no tlonbot prompt
// text is stored here.

export const TEMPLATES_DIR = path.join(LAB_DIR, 'templates');

export type Template = {
  version: 1;
  capturedAt: string;
  capturedFrom: string;
  openclaw: string;
  pluginCommit: string;
  model: string;
  settings: { reasoning?: Record<string, unknown>; maxTokens?: number };
  /** How the sandbox renders prompt placeholders; others stay literal. */
  substitutions: Record<string, string>;
  /** Workspace files that existed when the run started. */
  workspaceFiles: string[];
  /** Files OpenClaw injected into the prompt, in order. */
  injected: string[];
  system: string;
  tools: ChatTool[];
  /** The owner message wrapper: `{{STAMP}}` and `{{BODY}}`. */
  ownerFormat: string;
  /** Timezone OpenClaw stamps messages in. */
  stampTimezone: string;
  /** The runtime-context message sent after the current owner message. */
  runtimeContext: string;
  cron?: {
    system: string;
    injected: string[];
    tools: ChatTool[];
    /** `{{JOB_ID}}`, `{{JOB_NAME}}`, `{{PROMPT}}`, `{{NOW}}`, `{{UTC}}`. */
    message: string;
    /** How OpenClaw wrote the current time when captured. */
    nowExample: string;
  };
};

const text = (content: unknown): string =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part) => (part as { text?: string }).text ?? '').join('')
      : '';

const WORKSPACE = '/root/.openclaw/workspace';
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function frontmatter(skillText: string, field: string) {
  return new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(skillText)?.[1]?.trim();
}

/** OpenClaw's skill version: the start of the SKILL.md sha256. */
export function skillVersion(skillText: string) {
  return createHash('sha256').update(skillText).digest('hex').slice(0, 16);
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Cut workspace files, plugin skill entries and per-run values out of a prompt. */
function templatize(
  prompt: string,
  rendered: Record<string, string>,
  pluginSkills: string[]
) {
  let system = prompt;
  const injected: string[] = [];
  for (const [name, content] of Object.entries(rendered)) {
    const block = `## ${WORKSPACE}/${name}\n${content}`;
    if (!system.includes(block)) continue;
    system = system.replace(block, `## ${WORKSPACE}/${name}\n{{FILE:${name}}}`);
    injected.push(name);
  }
  injected.sort(
    (a, b) => system.indexOf(`{{FILE:${a}}}`) - system.indexOf(`{{FILE:${b}}}`)
  );
  for (const dir of pluginSkills) {
    const pattern = new RegExp(
      `(<name>${escapeRegExp(dir)}</name>\\s*<description>)[\\s\\S]*?(</description>[\\s\\S]*?<version>sha256:)[0-9a-f]+(</version>)`
    );
    if (!pattern.test(system)) continue;
    system = system.replace(
      pattern,
      `$1{{SKILL_DESCRIPTION:${dir}}}$2{{SKILL_VERSION:${dir}}}$3`
    );
  }
  system = system
    .replace(/sessionId=[\w-]+/g, 'sessionId={{SESSION_ID}}')
    .replace(/host=[\w.-]+/g, 'host={{HOST}}');
  return { system, injected };
}

/** Build a template from a real run's captured model traffic. */
export function extractTemplate(input: {
  exchanges: ModelExchange[];
  rendered: Record<string, string>;
  workspaceFiles: string[];
  substitutions: Record<string, string>;
  sources: PromptSources;
  openclaw: string;
  pluginCommit: string;
  capturedFrom: string;
}): Template {
  const isCron = (exchange: ModelExchange) =>
    (
      (exchange.request.messages ?? []) as { role: string; content: unknown }[]
    ).some((m) => m.role === 'user' && text(m.content).startsWith('[cron:'));
  const first = input.exchanges.find((e) => !isCron(e) && e.response);
  if (!first) throw new Error('no conversation request to calibrate from');
  const request = first.request as {
    model: string;
    messages: { role: string; content: unknown }[];
    tools: ChatTool[];
    reasoning?: Record<string, unknown>;
    max_completion_tokens?: number;
    max_tokens?: number;
  };
  const pluginSkills = input.sources.skills.map((skill) => skill.dir);
  const { system, injected } = templatize(
    text(request.messages.find((m) => m.role === 'system')?.content),
    input.rendered,
    pluginSkills
  );
  const users = request.messages.filter((m) => m.role === 'user');
  const owner = text(users[0]?.content);
  const stamp = /^\[([^\]]+)\] /.exec(owner);
  if (!stamp) throw new Error('owner message has no timestamp prefix');
  const runtime = text(users.at(-1)?.content).replace(
    /"message_id": "[^"]+"/,
    '"message_id": "{{MESSAGE_ID}}"'
  );
  const template: Template = {
    version: 1,
    capturedAt: new Date().toISOString(),
    capturedFrom: input.capturedFrom,
    openclaw: input.openclaw,
    pluginCommit: input.pluginCommit,
    model: request.model,
    settings: {
      ...(request.reasoning ? { reasoning: request.reasoning } : {}),
      maxTokens: request.max_completion_tokens ?? request.max_tokens,
    },
    substitutions: input.substitutions,
    workspaceFiles: input.workspaceFiles,
    injected,
    system,
    tools: request.tools,
    ownerFormat: '[{{STAMP}}] {{BODY}}',
    stampTimezone: stamp[1].split(' ').at(-1) ?? 'UTC',
    runtimeContext: runtime,
  };
  const cron = input.exchanges.find((e) => isCron(e));
  if (cron) {
    const cronRequest = cron.request as typeof request;
    const cronSystem = templatize(
      text(cronRequest.messages.find((m) => m.role === 'system')?.content),
      input.rendered,
      pluginSkills
    );
    const message = text(
      cronRequest.messages.find((m) => m.role === 'user')?.content
    );
    // `[cron:<id> <name>] <job prompt>` then OpenClaw's time lines.
    const parts =
      /^\[cron:(\S+) ([^\]]*)\] ([\s\S]*?)(\nCurrent time: [^\n]*)([\s\S]*)$/.exec(
        message
      );
    if (parts) {
      template.cron = {
        system: cronSystem.system,
        injected: cronSystem.injected,
        tools: cronRequest.tools ?? [],
        message: `[cron:{{JOB_ID}} {{JOB_NAME}}] {{PROMPT}}\nCurrent time: {{NOW}}${parts[5].replace(/^\nReference UTC: [^\n]*/, '\nReference UTC: {{UTC}}')}`,
        nowExample: parts[4].replace(/^\nCurrent time: /, ''),
      };
    }
  }
  return template;
}

/** What fast runs actually use from a template, without capture details. */
function substance(template: Template) {
  const { capturedAt, capturedFrom, pluginCommit, ...rest } = template;
  void capturedAt;
  void capturedFrom;
  void pluginCommit;
  return JSON.stringify(rest);
}

/** Save a template; returns undefined when nothing that matters changed. */
export function writeTemplate(template: Template) {
  mkdirSync(TEMPLATES_DIR, { recursive: true });
  const file = path.join(TEMPLATES_DIR, `openclaw-${template.openclaw}.json`);
  if (existsSync(file)) {
    const current = JSON.parse(readFileSync(file, 'utf8')) as Template;
    if (substance(current) === substance(template)) return undefined;
  }
  writeFileSync(file, `${JSON.stringify(template, null, 2)}\n`);
  return file;
}

/** The newest calibration template, if any. */
export function loadTemplate(): Template | undefined {
  if (process.env.LAB_NO_TEMPLATE) return undefined;
  if (!existsSync(TEMPLATES_DIR)) return undefined;
  const newest = readdirSync(TEMPLATES_DIR)
    .filter((name) => name.endsWith('.json'))
    .map(
      (name) =>
        JSON.parse(
          readFileSync(path.join(TEMPLATES_DIR, name), 'utf8')
        ) as Template
    )
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
  return newest;
}

/** Render a prompt file the way the sandbox does. */
export function renderLikeSandbox(
  textIn: string,
  template: Pick<Template, 'substitutions'>
) {
  return textIn.replace(
    /\$\{([A-Z_]+)\}/g,
    (match, name: string) => template.substitutions[name] ?? match
  );
}

const OPENCLAW_TRUNCATES_AT = 12_000;

/** A template's prompt with this variant's files and skills filled in. */
export function fillSystem(
  system: string,
  template: Template,
  sources: PromptSources,
  run: { sessionId: string }
) {
  let filled = system;
  for (const [name, file] of Object.entries(sources.prompts)) {
    const placeholder = `{{FILE:${name}}}`;
    if (!filled.includes(placeholder)) continue;
    const rendered = renderLikeSandbox(file.text, template);
    if (rendered.length > OPENCLAW_TRUNCATES_AT) {
      throw new Error(
        `${name} is ${rendered.length} characters; OpenClaw truncates injected files over ${OPENCLAW_TRUNCATES_AT}, which the fast lab does not reproduce`
      );
    }
    filled = filled.replace(placeholder, () => rendered);
  }
  for (const skill of sources.skills) {
    const description = frontmatter(skill.text, 'description') ?? '';
    filled = filled
      .replace(`{{SKILL_DESCRIPTION:${skill.dir}}}`, () =>
        escapeXml(description)
      )
      .replace(`{{SKILL_VERSION:${skill.dir}}}`, skillVersion(skill.text));
  }
  filled = filled
    .replace(/\{\{SESSION_ID\}\}/g, run.sessionId)
    .replace(/\{\{HOST\}\}/g, 'lab');
  const missing = /\{\{[A-Z_]+(?::[^}]+)?\}\}/.exec(filled);
  if (missing)
    throw new Error(`template placeholder left unfilled: ${missing[0]}`);
  return filled;
}

/** OpenClaw's message stamp, e.g. `Sat 2026-09-26 18:57 UTC`. */
export function stamp(now: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone === 'UTC' ? 'UTC' : timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return `${parts.weekday} ${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${timezone}`;
}

function ordinal(day: number) {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10];
  return `${day}${suffix ?? 'th'}`;
}

/** OpenClaw's cron time line, e.g. `Saturday, September 26th, 2026 - 7:14 PM (UTC)`. */
export function cronNow(now: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return `${parts.weekday}, ${parts.month} ${ordinal(Number(parts.day))}, ${parts.year} - ${parts.hour}:${parts.minute} ${parts.dayPeriod} (${timezone})`;
}

/** `2026-09-26 19:14 UTC` */
export function referenceUtc(now: Date) {
  return `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** The scheduled run's message, as OpenClaw's cron sends it. */
export function cronMessage(
  template: Template,
  input: { jobId: string; jobName: string; prompt: string; now: Date }
) {
  const cron = template.cron!;
  return cron.message
    .replace('{{JOB_ID}}', input.jobId)
    .replace('{{JOB_NAME}}', () => input.jobName)
    .replace('{{PROMPT}}', () => input.prompt)
    .replace('{{NOW}}', cronNow(input.now, template.stampTimezone))
    .replace('{{UTC}}', referenceUtc(input.now));
}
