import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { writeCheckpoint } from './checkpoint.js';
import {
  type LabConfig,
  PERSONAS_DIR,
  PLUGIN_DIR,
  type PromptSources,
  REPO_ROOT,
  RUBRIC_PATH,
  RUNS_DIR,
  sha256,
} from './config.js';
import type { Persona, RunRecord, RunSetManifest } from './types.js';

export function loadPersonas(ids?: string[]): Persona[] {
  const all = readdirSync(PERSONAS_DIR)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => {
      const persona = parse(
        readFileSync(path.join(PERSONAS_DIR, name), 'utf8')
      ) as Persona;
      return { ...persona, id: persona.id ?? name.replace(/\.yaml$/, '') };
    });
  if (!ids?.length) return all;
  const missing = ids.filter((id) => !all.some((persona) => persona.id === id));
  if (missing.length)
    throw new Error(`Unknown personas: ${missing.join(', ')}`);
  return all.filter((persona) => ids.includes(persona.id));
}

function git(args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

export function createRunSet(input: {
  label: string;
  config: LabConfig;
  sources: PromptSources;
  variant?: string;
  personas: Persona[];
  repeat: number;
  maxTurns: number;
  judge: boolean;
  tips: number;
}): { dir: string; manifest: RunSetManifest } {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const slug = input.label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const dir = path.join(RUNS_DIR, `${stamp}-${slug}`);
  mkdirSync(dir, { recursive: true });
  const sourceFiles = [
    ...input.sources.skills,
    ...(input.sources.coordinator ? [input.sources.coordinator] : []),
    ...Object.values(input.sources.prompts),
    ...Object.values(input.sources.resources),
  ];
  const manifest: RunSetManifest = {
    label: input.label,
    createdAt: new Date().toISOString(),
    gitRev: git(['rev-parse', '--short', 'HEAD']),
    gitDirty: git(['status', '--porcelain', '--', PLUGIN_DIR]) !== '',
    models: input.config.models,
    sources: sourceFiles.map((file) => ({
      path: path.relative(REPO_ROOT, file.path).startsWith('..')
        ? file.path
        : path.relative(REPO_ROOT, file.path),
      sha256: sha256(file.text),
    })),
    ...(input.variant ? { variant: input.variant } : {}),
    search: input.config.search,
    personas: input.personas.map((persona) => persona.id),
    repeat: input.repeat,
    checkpoint: writeCheckpoint(dir, {
      models: input.config.models,
      search: input.config.search,
      maxTurns: input.maxTurns,
      judge: input.judge,
      tips: input.tips,
      sources: input.sources,
      personas: input.personas,
      personaCards: Object.fromEntries(input.personas.map((persona) => [persona.id, readFileSync(path.join(PERSONAS_DIR, `${persona.id}.yaml`), 'utf8')])),
      rubric: readFileSync(RUBRIC_PATH, 'utf8'),
    }),
  };
  writeFileSync(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return { dir, manifest };
}

export function writeRun(dir: string, record: RunRecord) {
  writeFileSync(
    path.join(dir, `${record.persona.id}.${record.repeat}.json`),
    `${JSON.stringify(record, null, 2)}\n`
  );
}

/** Accepts a path, a run-set folder name, or a unique suffix like "baseline". */
export function resolveRunSet(reference: string): string {
  if (existsSync(path.join(reference, 'manifest.json'))) {
    return path.resolve(reference);
  }
  const names = existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR).sort() : [];
  const matches = names.filter(
    (name) => name === reference || name.endsWith(`-${reference}`)
  );
  if (!matches.length) throw new Error(`No run set matches "${reference}"`);
  return path.join(RUNS_DIR, matches[matches.length - 1]);
}

export function loadRunSet(dir: string): {
  dir: string;
  manifest: RunSetManifest;
  runs: RunRecord[];
} {
  const manifest = JSON.parse(
    readFileSync(path.join(dir, 'manifest.json'), 'utf8')
  ) as RunSetManifest;
  const runs = readdirSync(dir)
    .filter((name) => /\.\d+\.json$/.test(name))
    .sort()
    .map(
      (name) =>
        JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as RunRecord
    );
  return { dir, manifest, runs };
}
