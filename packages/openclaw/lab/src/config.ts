import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LAB_DIR = path.dirname(
  path.dirname(fileURLToPath(import.meta.url))
);
export const PLUGIN_DIR = path.dirname(LAB_DIR);
export const REPO_ROOT = path.resolve(PLUGIN_DIR, '../..');
export const RUNS_DIR = path.join(LAB_DIR, 'runs');
export const PERSONAS_DIR = path.join(LAB_DIR, 'personas');
export const RUBRIC_PATH = path.join(LAB_DIR, 'rubric.md');
export const SKILL_PATH = path.join(
  PLUGIN_DIR,
  'skills/tlon-agent-onboarding/SKILL.md'
);

/**
 * The skills the plugin installs under ~/.openclaw/plugin-skills/<dir>, in the
 * order openclaw.plugin.json lists them. The bot sees all of them, not only the
 * onboarding skill.
 */
const INSTALLED_SKILLS = [
  {
    dir: 'tlon-skill',
    path: path.join(REPO_ROOT, 'packages/tlon-skill/SKILL.md'),
  },
  { dir: 'tlon-agent-onboarding', path: SKILL_PATH },
  {
    dir: 'tlon-product-guide',
    path: path.join(PLUGIN_DIR, 'skills/tlon-product-guide/SKILL.md'),
  },
];
export const ONBOARDING_SKILL_DIR = 'tlon-agent-onboarding';
export const PRODUCT_GUIDE_DIR = 'tlon-product-guide';

// The fixed identities the rendered prompts and tools agree on.
export const BOT_SHIP = '~zod';
export const OWNER_SHIP = '~ten';
export const ONBOARDING_GROUP_ID = '~ten/tlonbot-lab';
export const NOTEBOOK_NAME = 'Updates';

function parseEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

function findTlonbotDir(env: Record<string, string | undefined>) {
  const candidates = [
    env.TLONBOT_DIR,
    path.resolve(REPO_ROOT, '../tlonbot'),
    path.join(os.homedir(), 'Projects/tlonbot'),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const found = candidates.find((candidate) =>
    existsSync(path.join(candidate, 'prompts/AGENTS.md'))
  );
  if (!found) {
    throw new Error(
      'Could not find a tlonbot checkout with prompts/. Set TLONBOT_DIR in lab/.env or your shell.'
    );
  }
  return found;
}

export type LabConfig = {
  tlonbotDir: string;
  openrouterKey: string;
  braveKey?: string;
  models: { bot: string; user: string; judge: string };
};

export function loadConfig(overrides: Partial<LabConfig['models']> = {}) {
  const labEnv = parseEnvFile(path.join(LAB_DIR, '.env'));
  const env = { ...labEnv, ...process.env };
  const tlonbotDir = findTlonbotDir(env);
  const tlonbotEnv = parseEnvFile(path.join(tlonbotDir, 'tests/.env'));
  const openrouterKey =
    env.OPENROUTER_API_KEY ?? tlonbotEnv.OPENROUTER_API_KEY ?? '';
  if (!openrouterKey) {
    throw new Error(
      'No OpenRouter key. Set OPENROUTER_API_KEY, or keep it in tlonbot tests/.env.'
    );
  }
  const stackModel = tlonbotEnv.MODEL?.replace(/^openrouter\//, '');
  return {
    tlonbotDir,
    openrouterKey,
    braveKey: env.BRAVE_API_KEY ?? tlonbotEnv.BRAVE_API_KEY,
    models: {
      bot:
        overrides.bot ?? env.LAB_BOT_MODEL ?? stackModel ?? 'openai/gpt-6-luna',
      user:
        overrides.user ??
        env.LAB_USER_MODEL ??
        stackModel ??
        'openai/gpt-6-luna',
      judge:
        overrides.judge ?? env.LAB_JUDGE_MODEL ?? 'anthropic/claude-opus-5.5',
    },
  } satisfies LabConfig;
}

export type SourceFile = { path: string; text: string };

export type PromptSources = {
  /** The onboarding skill (also present in `skills`). */
  skill: SourceFile;
  skills: (SourceFile & { dir: string })[];
  prompts: Record<string, SourceFile>;
};

/**
 * The installed skills plus tlonbot's workspace prompts. In a variant folder,
 * `SKILL.md` replaces the onboarding skill, `<skill-dir>/SKILL.md` (such as
 * `tlon-product-guide/SKILL.md`) replaces that skill, and any other `.md` file
 * replaces the tlonbot prompt of the same name. A variant can be the onboarding
 * sandbox's `.sandbox-prompts` folder or any folder of edited copies.
 */
export function loadPromptSources(
  config: LabConfig,
  variantDir?: string
): PromptSources {
  const read = (file: string) => ({
    path: file,
    text: readFileSync(file, 'utf8'),
  });
  const promptsDir = path.join(config.tlonbotDir, 'prompts');
  const prompts: PromptSources['prompts'] = {};
  for (const name of readdirSync(promptsDir)) {
    if (name.endsWith('.md')) prompts[name] = read(path.join(promptsDir, name));
  }
  const skills = INSTALLED_SKILLS.map(({ dir, path: file }) => {
    const override = variantDir
      ? [
          path.join(variantDir, dir, 'SKILL.md'),
          ...(dir === ONBOARDING_SKILL_DIR
            ? [path.join(variantDir, 'SKILL.md')]
            : []),
        ].find((candidate) => existsSync(candidate))
      : undefined;
    return { dir, ...read(override ?? file) };
  });
  if (variantDir) {
    for (const name of readdirSync(variantDir)) {
      if (name.endsWith('.md') && name !== 'SKILL.md') {
        prompts[name] = read(path.join(variantDir, name));
      }
    }
  }
  const skill = skills.find((entry) => entry.dir === ONBOARDING_SKILL_DIR)!;
  return { skill, skills, prompts };
}

export function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** Mirrors the envsubst the dev stack applies to workspace prompts. */
export function renderPrompt(text: string, botModel: string) {
  const values: Record<string, string> = {
    TLON_SHIP: BOT_SHIP,
    TLON_OWNER_SHIP: OWNER_SHIP,
    TLON_URL: 'http://localhost:8080',
    TLON_OWNER_URL: 'http://localhost:8081',
    TLON_OWNER_CONFIG_PATH: '/root/.tlon/owner.json',
    MODEL: `openrouter/${botModel}`,
  };
  return text.replace(
    /\$\{([A-Z_]+)\}/g,
    (match, name: string) => values[name] ?? match
  );
}
