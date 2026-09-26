import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { type PromptSources, sha256 } from './config.js';
import type { Persona, RunSetManifest } from './types.js';
import {
  DOUBLE_TEXT_RATE,
  KEEP_RULES,
  TIP_MOVE_RULES,
  USER_RULES,
} from './user.js';
import { CAMPAIGN_PROMPT_POLICY } from '../../src/monitor/campaign/personalize.js';

export type PromptCheckpoint = {
  version: 1;
  models: RunSetManifest['models'];
  search: boolean;
  maxTurns: number;
  judge: boolean;
  tips: number;
  sources: PromptSources;
  personas: Record<string, string>;
  rubric: string;
  simulatorPolicy: string;
  /** Share of moves that get a quick second message (--double-texts). */
  doubleTextRate?: number;
  tipMovePolicy: string;
  keepPolicy: string;
  campaignPromptPolicy: string;
};

const FILE = 'checkpoint/index.json';

export function writeCheckpoint(
  dir: string,
  input: {
    models: RunSetManifest['models'];
    search: boolean;
    maxTurns: number;
    judge: boolean;
    tips: number;
    sources: PromptSources;
    personas: Persona[];
    personaCards: Record<string, string>;
    rubric: string;
    doubleTexts?: boolean;
  }
): RunSetManifest['checkpoint'] {
  const checkpoint: PromptCheckpoint = {
    version: 1,
    models: input.models,
    search: input.search,
    maxTurns: input.maxTurns,
    judge: input.judge,
    tips: input.tips,
    sources: input.sources,
    personas: Object.fromEntries(
      input.personas.map((persona) => [
        persona.id,
        input.personaCards[persona.id],
      ])
    ),
    rubric: input.rubric,
    simulatorPolicy: USER_RULES,
    ...(input.doubleTexts ? { doubleTextRate: DOUBLE_TEXT_RATE } : {}),
    tipMovePolicy: TIP_MOVE_RULES,
    keepPolicy: KEEP_RULES,
    campaignPromptPolicy: CAMPAIGN_PROMPT_POLICY,
  };
  mkdirSync(path.join(dir, 'checkpoint'), { recursive: true });
  writeFileSync(
    path.join(dir, FILE),
    `${JSON.stringify(checkpoint, null, 2)}\n`
  );
  return { version: 1, file: FILE };
}

export function loadCheckpoint(
  dir: string,
  manifest: RunSetManifest
): PromptCheckpoint | undefined {
  if (!manifest.checkpoint) return;
  if (manifest.checkpoint.version !== 1 || manifest.checkpoint.file !== FILE)
    throw new Error('Unsupported prompt checkpoint');
  const checkpoint = JSON.parse(
    readFileSync(path.join(dir, FILE), 'utf8')
  ) as PromptCheckpoint;
  if (checkpoint.version !== 1)
    throw new Error('Unsupported prompt checkpoint version');
  return checkpoint;
}

export function checkpointPersonas(checkpoint: PromptCheckpoint): Persona[] {
  return Object.entries(checkpoint.personas).map(([id, text]) => ({
    ...(parseYaml(text) as Persona),
    id,
  }));
}

export function frozenResumeInputs(dir: string, manifest: RunSetManifest) {
  const checkpoint = loadCheckpoint(dir, manifest);
  if (!checkpoint) return;
  return {
    checkpoint,
    sources: checkpoint.sources,
    personas: checkpointPersonas(checkpoint),
    maxTurns: checkpoint.maxTurns,
    judge: checkpoint.judge,
    tips: checkpoint.tips,
    rubric: checkpoint.rubric,
    simulatorPolicy: checkpoint.simulatorPolicy,
    doubleTextRate: checkpoint.doubleTextRate,
    tipMovePolicy: checkpoint.tipMovePolicy,
    keepPolicy: checkpoint.keepPolicy,
    campaignPromptPolicy: checkpoint.campaignPromptPolicy,
  };
}

export function checkpointSourceHashes(checkpoint: PromptCheckpoint) {
  return [
    ...checkpoint.sources.skills,
    ...Object.values(checkpoint.sources.prompts),
    ...Object.values(checkpoint.sources.resources),
    ...(checkpoint.sources.coordinator ? [checkpoint.sources.coordinator] : []),
    ...(checkpoint.sources.tipCopy ? [checkpoint.sources.tipCopy] : []),
  ].map((source) => ({ path: source.path, sha256: sha256(source.text) }));
}
