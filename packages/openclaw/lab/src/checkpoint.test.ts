import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import {
  loadCheckpoint,
  frozenResumeInputs,
  writeCheckpoint,
} from './checkpoint.js';
import { loadPromptSources, type LabConfig } from './config.js';
import { writePackets } from './packets.js';
import { renderRunSetReport } from './report.js';
import type { Persona, RunRecord, RunSetManifest } from './types.js';

const created: string[] = [];
afterEach(() => {
  for (const file of created.splice(0))
    rmSync(file, { recursive: true, force: true });
});

test('checkpoint freezes workspace, nested skill, coordinator, card and rubric without .env', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lab-checkpoint-'));
  created.push(root);
  const prompts = path.join(root, 'prompts');
  const variant = path.join(root, 'variant');
  const skillDir = path.join(variant, 'tlon-agent-onboarding');
  mkdirSync(prompts);
  mkdirSync(path.join(skillDir, 'references'), { recursive: true });
  writeFileSync(path.join(prompts, 'AGENTS.md'), 'agents-before');
  writeFileSync(path.join(prompts, 'SOUL.md'), 'soul-before');
  writeFileSync(path.join(prompts, 'BOOTSTRAP.md'), 'bootstrap-before');
  writeFileSync(path.join(prompts, '.env'), 'API_KEY=must-not-appear');
  writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    'name: onboarding\nskill-before'
  );
  writeFileSync(
    path.join(skillDir, 'references', 'guide.md'),
    'resource-before'
  );
  writeFileSync(
    path.join(variant, 'coordinator.yaml'),
    'welcome:\n  text: coordinator-before\n'
  );
  const config: LabConfig = {
    tlonbotDir: root,
    openrouterKey: 'do-not-serialize',
    search: false,
    models: { bot: 'bot', user: 'user', judge: 'judge' },
  };
  const sources = loadPromptSources(config, variant);
  const card: Persona = {
    id: 'test-person',
    who: 'card-before',
    wants: 'help',
    expectPlan: 'no',
  };
  const set = path.join(root, 'set');
  mkdirSync(set);
  const pointer = writeCheckpoint(set, {
    models: config.models,
    search: false,
    maxTurns: 4,
    judge: false,
    tips: 2,
    sources,
    personas: [card],
    personaCards: {
      [card.id]:
        'id: test-person\nwho: card-before\nwants: help\nexpectPlan: no\n',
    },
    rubric: 'rubric-before',
  })!;
  const manifest = {
    label: 'test',
    createdAt: '',
    gitRev: '',
    gitDirty: false,
    models: config.models,
    sources: [],
    personas: [card.id],
    repeat: 1,
    checkpoint: pointer,
  } satisfies RunSetManifest;
  writeFileSync(path.join(set, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(path.join(prompts, 'SOUL.md'), 'soul-after');
  rmSync(path.join(prompts, 'BOOTSTRAP.md'));
  rmSync(path.join(skillDir, 'references', 'guide.md'));
  rmSync(path.join(variant, 'coordinator.yaml'));
  const loaded = loadCheckpoint(set, manifest)!;
  expect(loaded.sources.prompts['SOUL.md'].text).toBe('soul-before');
  expect(loaded.sources.prompts['BOOTSTRAP.md'].text).toBe('bootstrap-before');
  expect(
    loaded.sources.resources['tlon-agent-onboarding/references/guide.md'].text
  ).toBe('resource-before');
  expect(loaded.sources.coordinator?.overrides.welcome?.text).toBe(
    'coordinator-before'
  );
  const resumed = frozenResumeInputs(set, manifest)!;
  expect(resumed.personas[0].who).toBe('card-before');
  expect(resumed.sources.prompts['SOUL.md'].text).toBe('soul-before');
  expect(resumed.maxTurns).toBe(4);
  expect(resumed.tips).toBe(2);
  expect(loaded.rubric).toBe('rubric-before');
  const serialized = readFileSync(path.join(set, pointer.file), 'utf8');
  expect(serialized).not.toContain('API_KEY');
  expect(serialized).not.toContain('do-not-serialize');
  expect(serialized).not.toContain('.env');

  const record = {
    persona: card,
    repeat: 1,
    startedAt: '2026-09-21T14:00:00.000Z',
    durationMs: 1,
    models: config.models,
    transcript: [],
    turns: [],
    firstRunToolCalls: [],
    facts: {
      ending: 'user-left',
      userTurns: 0,
      choicesPosted: 0,
      botTextMessages: 0,
      silentTurns: 0,
      suppressedNarration: 0,
      planCreated: false,
      planMatchesExpectation: true,
      firstResultOk: null,
      onboardingComplete: false,
      toolCounts: {},
      blockedToolCalls: 0,
      toolErrors: 0,
    },
    costUsd: 0,
  } satisfies RunRecord;
  writeFileSync(path.join(set, 'test-person.1.json'), JSON.stringify(record));
  const second = path.join(root, 'second');
  mkdirSync(second);
  writeFileSync(
    path.join(second, 'manifest.json'),
    JSON.stringify({ ...manifest, label: 'second' })
  );
  mkdirSync(path.join(second, 'checkpoint'));
  writeFileSync(path.join(second, pointer.file), serialized);
  writeFileSync(
    path.join(second, 'test-person.1.json'),
    JSON.stringify(record)
  );
  const packet = writePackets(config, [set, second]);
  created.push(packet.dir, `${packet.dir}.mapping.json`);
  expect(
    readFileSync(path.join(packet.dir, 'INSTRUCTIONS.md'), 'utf8')
  ).toContain('rubric-before');
  expect(
    readFileSync(path.join(packet.dir, 'skills', 'product-guide.md'), 'utf8')
  ).toBe(
    loaded.sources.skills.find((skill) => skill.dir === 'tlon-product-guide')
      ?.text
  );
  expect(
    readFileSync(path.join(packet.dir, 'skills', 'skill-1.md'), 'utf8')
  ).toContain('skill-before');
});

test('legacy manifest and record still render', () => {
  const manifest = {
    label: 'old',
    createdAt: '',
    gitRev: '',
    gitDirty: false,
    models: { bot: 'b', user: 'u', judge: 'j' },
    sources: [],
    personas: [],
    repeat: 1,
  } satisfies RunSetManifest;
  expect(renderRunSetReport(manifest, [])).toContain(
    'legacy live prompt sources'
  );
});

test('skill reference symlink escapes are rejected', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lab-symlink-'));
  created.push(root);
  mkdirSync(path.join(root, 'prompts'));
  mkdirSync(path.join(root, 'variant', 'tlon-agent-onboarding', 'references'), {
    recursive: true,
  });
  writeFileSync(path.join(root, 'prompts', 'AGENTS.md'), 'agents');
  writeFileSync(path.join(root, 'outside.md'), 'outside');
  symlinkSync(
    path.join(root, 'outside.md'),
    path.join(
      root,
      'variant',
      'tlon-agent-onboarding',
      'references',
      'escape.md'
    )
  );
  const config: LabConfig = {
    tlonbotDir: root,
    openrouterKey: '',
    search: false,
    models: { bot: 'b', user: 'u', judge: 'j' },
  };
  expect(() => loadPromptSources(config, path.join(root, 'variant'))).toThrow(
    'symlink'
  );
});
