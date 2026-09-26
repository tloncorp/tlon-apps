import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as toYaml } from 'yaml';
import type {
  CampaignState,
  CampaignTask,
  StepId,
} from '../../src/monitor/campaign/model.js';
import {
  acceptPersonalization,
  buildPersonalizationPrompt,
} from '../../src/monitor/campaign/personalize.js';
import {
  TIP_COPY,
  type TipCopy,
  renderTip,
} from '../../src/monitor/campaign/templates.js';
import { agentOnboardingTesting } from '../../src/monitor/agent-onboarding.js';
import { ONBOARDING_JOB_NAME } from '../../src/monitor/onboarding-job.js';
import {
  LAB_DIR,
  PLUGIN_DIR,
  PRODUCT_GUIDE_DIR,
  REPO_ROOT,
  loadConfig,
  loadPromptSources,
} from './config.js';
import { chat } from './openrouter.js';

// The editing side of the lab page: variant folders and their files, and a
// tip previewer that renders production tip logic with a variant's copy.

export const VARIANTS_DIR = path.join(LAB_DIR, 'variants');

const PROMPT_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'MEMORY.md',
  'BOOTSTRAP.md',
  'BOOT.md',
];

/** Files a variant may hold, in the order the editor lists them. */
export const EDITABLE_FILES = [
  'SKILL.md',
  'coordinator.yaml',
  'tips.yaml',
  'tlon-product-guide/SKILL.md',
  ...PROMPT_FILES,
];

const BASELINE = 'baseline';

/** OpenClaw's stock workspace templates, which tlonbot's prompts replace. */
function openclawPackageDir() {
  return [
    path.join(PLUGIN_DIR, 'node_modules/openclaw'),
    path.join(REPO_ROOT, 'node_modules/openclaw'),
  ].find((dir) => existsSync(path.join(dir, 'package.json')));
}

export function openclawDefault(file: string) {
  const dir = openclawPackageDir();
  if (!dir || !PROMPT_FILES.includes(file)) return null;
  const template = path.join(dir, 'docs/reference/templates', file);
  if (!existsSync(template)) return null;
  const version = (
    JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
      version?: string;
    }
  ).version;
  // Templates carry docs-site frontmatter that never reaches a workspace.
  const text = readFileSync(template, 'utf8').replace(
    /^---\n[\s\S]*?\n---\n+/,
    ''
  );
  return { text, version: version ?? 'unknown' };
}

function checkName(name: string) {
  if (!/^[a-z0-9][a-z0-9._-]{0,40}$/i.test(name) || name === BASELINE) {
    throw new Error(
      `Variant names use letters, numbers, . _ - (got "${name}")`
    );
  }
  return name;
}

function checkFile(file: string) {
  if (!EDITABLE_FILES.includes(file)) {
    throw new Error(`Not an editable variant file: ${file}`);
  }
  return file;
}

/** What the lab uses for a file when a variant doesn't replace it. */
export function baselineFile(file: string): string {
  const sources = loadPromptSources(loadConfig());
  if (file === 'SKILL.md') return sources.skill.text;
  if (file === 'tlon-product-guide/SKILL.md') {
    return sources.skills.find((skill) => skill.dir === PRODUCT_GUIDE_DIR)!
      .text;
  }
  if (file === 'tips.yaml') return toYaml(TIP_COPY, { lineWidth: 0 });
  if (file === 'coordinator.yaml') {
    return toYaml(
      { welcome: { text: agentOnboardingTesting.welcomeText } },
      { lineWidth: 0 }
    );
  }
  return sources.prompts[file]?.text ?? '';
}

function parentOf(name: string) {
  const file = path.join(VARIANTS_DIR, name, '.parent');
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : BASELINE;
}

export function listVariants() {
  const variants = existsSync(VARIANTS_DIR)
    ? readdirSync(VARIANTS_DIR)
        .filter((name) => statSync(path.join(VARIANTS_DIR, name)).isDirectory())
        .sort()
        .map((name) => ({
          name,
          parent: parentOf(name),
          readOnly: false,
          files: EDITABLE_FILES.filter((file) =>
            existsSync(path.join(VARIANTS_DIR, name, file))
          ),
        }))
    : [];
  return [
    { name: BASELINE, parent: null, readOnly: true, files: EDITABLE_FILES },
    ...variants,
  ];
}

/** The text a variant's run would actually use for `file`. */
function effectiveText(name: string, file: string): string {
  if (name === BASELINE) return baselineFile(file);
  const own = path.join(VARIANTS_DIR, name, file);
  return existsSync(own) ? readFileSync(own, 'utf8') : baselineFile(file);
}

export function readVariantFile(name: string, file: string) {
  checkFile(file);
  if (name !== BASELINE) checkName(name);
  const parent = name === BASELINE ? null : parentOf(name);
  const own = path.join(VARIANTS_DIR, name, file);
  return {
    variant: name,
    file,
    readOnly: name === BASELINE,
    exists: name === BASELINE || existsSync(own),
    text: effectiveText(name, file),
    parent,
    parentText: parent ? effectiveText(parent, file) : null,
    productionText: baselineFile(file),
    openclaw: openclawDefault(file),
  };
}

export function writeVariantFile(name: string, file: string, text: string) {
  checkName(name);
  checkFile(file);
  const dir = path.join(VARIANTS_DIR, name);
  if (!existsSync(dir)) throw new Error(`No variant named ${name}`);
  if (file.endsWith('.yaml')) {
    const parsed = parseYaml(text) ?? {};
    if (file === 'tips.yaml') tipOverrides(text);
    if (typeof parsed !== 'object') throw new Error(`${file} must be a map`);
  }
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), text);
}

export function createVariant(name: string, from: string) {
  checkName(name);
  const dir = path.join(VARIANTS_DIR, name);
  if (existsSync(dir)) throw new Error(`${name} already exists`);
  mkdirSync(dir, { recursive: true });
  if (from === BASELINE) {
    writeFileSync(path.join(dir, 'SKILL.md'), baselineFile('SKILL.md'));
  } else {
    checkName(from);
    for (const file of EDITABLE_FILES) {
      const source = path.join(VARIANTS_DIR, from, file);
      if (!existsSync(source)) continue;
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      copyFileSync(source, path.join(dir, file));
    }
  }
  writeFileSync(path.join(dir, '.parent'), `${from}\n`);
  return listVariants().find((variant) => variant.name === name)!;
}

/** Parse tips.yaml text into overrides, rejecting keys the product lacks. */
export function tipOverrides(text: string): Partial<TipCopy> {
  const parsed = (parseYaml(text) ?? {}) as Record<string, unknown>;
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('tips.yaml must be a map of copy keys to text');
  }
  const unknown = Object.keys(parsed).filter((key) => !(key in TIP_COPY));
  if (unknown.length)
    throw new Error(`Unknown tip keys: ${unknown.join(', ')}`);
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') throw new Error(`${key} must be text`);
  }
  return parsed as Partial<TipCopy>;
}

export type TipSample = {
  topic?: string;
  purpose?: string;
  lastOwnerText?: string;
  taskName?: string;
};

type TipCase = {
  id: string;
  step: StepId;
  label: string;
  state: CampaignState;
  task?: CampaignTask;
};

function tipCaseList(sample: TipSample): TipCase[] {
  const base = {
    owner: '~ten',
    version: 1,
    enrolledAt: 0,
    status: 'active',
    sent: [],
    skipped: [],
    lastOwnerText: sample.lastOwnerText || undefined,
  } as unknown as CampaignState;
  // After day 1 the campaign keeps whatever setup topic it learned.
  const afterFirst = {
    ...base,
    topic: sample.topic || undefined,
    sent: [{ step: 'useful-request' as StepId, at: 0 }],
  };
  const task: CampaignTask = {
    id: 'job',
    name: sample.taskName?.trim() || ONBOARDING_JOB_NAME,
    enabled: true,
  };
  return [
    {
      id: 'first',
      step: 'useful-request',
      label: 'Day 1 · no setup context',
      state: base,
    },
    {
      id: 'first-topic',
      step: 'useful-request',
      label: 'Day 1 · topic from setup',
      state: { ...base, topic: sample.topic || 'your setup topic' },
    },
    {
      id: 'first-purpose',
      step: 'useful-request',
      label: 'Day 1 · purpose only',
      state: { ...base, purpose: sample.purpose || 'Daily brief' },
    },
    {
      id: 'recurring',
      step: 'recurring-help',
      label: 'Day 2 · recurring help (no task yet)',
      state: afterFirst,
    },
    {
      id: 'archive',
      step: 'archive',
      label: 'Day 3 · archive',
      state: afterFirst,
    },
    {
      id: 'material',
      step: 'own-material',
      label: 'Day 5 · own material',
      state: afterFirst,
    },
    {
      id: 'feedback-delivered',
      step: 'task-feedback',
      label: 'Task feedback · delivered',
      state: afterFirst,
      task: { ...task, deliveredAt: 1 },
    },
    {
      id: 'feedback-failed',
      step: 'task-feedback',
      label: 'Task feedback · failed',
      state: afterFirst,
      task: { ...task, failedAt: 1 },
    },
    {
      id: 'feedback-scheduled',
      step: 'task-feedback',
      label: 'Task feedback · not run yet',
      state: afterFirst,
      task,
    },
    {
      id: 'closing',
      step: 'closing',
      label: 'Closing · no task',
      state: afterFirst,
    },
    {
      id: 'closing-after-feedback',
      step: 'closing',
      label: 'Closing · after task feedback',
      state: {
        ...afterFirst,
        sent: [...afterFirst.sent, { step: 'task-feedback' as StepId, at: 0 }],
      },
      task: { ...task, deliveredAt: 1 },
    },
    {
      id: 'closing-failed',
      step: 'closing',
      label: 'Closing · task failed',
      state: afterFirst,
      task: { ...task, failedAt: 1 },
    },
    {
      id: 'closing-quiet',
      step: 'closing',
      label: 'Closing · after two unanswered tips',
      state: { ...afterFirst, status: 'feedback' },
    },
  ];
}

/** Every tip in every situation, rendered by production logic. */
export function previewTips(tipsYaml: string, sample: TipSample) {
  const copy: TipCopy = { ...TIP_COPY, ...tipOverrides(tipsYaml) };
  return tipCaseList(sample).map(({ id, step, label, state, task }) => ({
    id,
    step,
    label,
    text: renderTip(step, state, task, copy),
  }));
}

/** One real personalization call for a case, as the campaign would make it. */
export async function personalizeTipCase(
  tipsYaml: string,
  sample: TipSample,
  id: string
) {
  const copy: TipCopy = { ...TIP_COPY, ...tipOverrides(tipsYaml) };
  const item = tipCaseList(sample).find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown tip case ${id}`);
  const draft = {
    step: item.step,
    state: item.state,
    task: item.task,
    text: renderTip(item.step, item.state, item.task, copy),
  };
  const config = loadConfig({}, { search: false });
  const meter = { usd: 0 };
  const reply = await chat({
    key: config.openrouterKey,
    model: config.models.bot,
    messages: [{ role: 'user', content: buildPersonalizationPrompt(draft) }],
    maxTokens: 2000,
    meter,
  });
  const text = acceptPersonalization(draft, reply.content ?? undefined);
  return {
    text: text ?? null,
    note: text
      ? null
      : 'The campaign would send the base tip (no usable personalization).',
    costUsd: meter.usd,
  };
}
