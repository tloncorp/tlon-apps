import { parseGroupKitConfig } from '@tloncorp/api';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { toWireKit } from './index.js';
import { loadKit } from './loader.js';

const mealPlanDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'kits',
  'meal-plan'
);

const kit = loadKit(mealPlanDir);

describe('the meal-plan kit', () => {
  // The id is a contract with onboarding: TASK-5's picker records
  // `starterKitId: 'meal-plan'`, and provisioning looks the kit up by it.
  it('is identified as meal-plan', () => {
    expect(kit.manifest.id).toBe('meal-plan');
    expect(kit.manifest.scope).toBe('group');
  });

  it('validates and round-trips to the wire shape', () => {
    const wire = toWireKit(kit);
    expect(wire.manifest.id).toBe('meal-plan');
    expect(wire.manifest.places.map((p) => p.name).sort()).toEqual([
      'kitchen',
      'plans',
    ]);
  });

  // One primary conversation, one durable artifact store. The artifact place is
  // %notes-backed, not `notebook` — that maps to %diary, which is deprecated
  // and carries a migration path off it, so the hero workspace would have
  // shipped needing migration on day one.
  it('has a conversation and a durable artifact place backed by notes', () => {
    expect(kit.manifest.places.kitchen.type).toBe('chat');
    expect(kit.manifest.places.plans.type).toBe('notes');
  });

  it('declares one weekly schedule', () => {
    expect(kit.manifest.schedules).toHaveLength(1);
    expect(kit.manifest.schedules[0]).toMatchObject({
      id: 'weekly-plan',
      cron: '0 17 * * 5',
    });
  });

  // The setup instruction is what produces the starter artifact, so it has to
  // be bound to the install trigger and has to know where the artifact goes.
  it('binds setup to install and the plan to its schedule', () => {
    const byTrigger = new Map(
      kit.manifest.bindings.map((b) => [b.trigger ?? 'ambient', b])
    );
    expect(byTrigger.get('install.setup')?.file).toBe('instructions/setup.md');
    expect(byTrigger.get('schedule.weekly-plan')?.file).toBe(
      'instructions/weekly-plan.md'
    );
    expect(byTrigger.get('ambient')?.load).toBe('ambient');
  });

  it('ships every file its bindings and scaffolds name', () => {
    for (const binding of kit.manifest.bindings) {
      expect(kit.files[binding.file], binding.file).toBeTruthy();
    }
    for (const scaffold of kit.manifest.scaffolds) {
      expect(kit.files[scaffold.file], scaffold.file).toBeTruthy();
    }
  });

  it('tells setup to write into the artifact place', () => {
    const setup = kit.files['instructions/setup.md'];
    expect(setup).toMatch(/Meal Plans/);
    expect(setup).toMatch(/grocery list/i);
  });

  // doc-1 §5: the meal wedge's first turn must propose a week rather than
  // interrogate the household. This is the property that makes the starter
  // artifact an artifact rather than a questionnaire.
  it('tells setup to propose rather than interview', () => {
    const setup = kit.files['instructions/setup.md'];
    expect(setup).toMatch(/Do not open with questions/);
    expect(setup).toMatch(/Do not ask what they like before showing them/);
  });

  // AC #4's other half: the kit declares a schedule but must not present it
  // during onboarding. Setup is explicitly told not to raise it.
  it('keeps setup away from the schedule question', () => {
    expect(kit.files['instructions/setup.md']).toMatch(
      /Do not ask about the schedule/
    );
  });
});

// A kit is markdown a harness loads into whatever model is configured. Naming a
// provider or a model in kit content would bake a deployment choice into shared
// content — and a review is unlikely to catch a model name pasted into a
// prompt, where a test will.
describe('kit content carries no provider or model configuration', () => {
  const forbidden = [
    'openai',
    'anthropic',
    'claude',
    'gpt-',
    'gemini',
    'llama',
    'mistral',
    'openrouter',
    'api_key',
    'apikey',
    'api key',
    'temperature',
    'max_tokens',
    'system_prompt',
  ];

  it.each(Object.keys(kit.files))('%s', (file) => {
    const haystack = kit.files[file].toLowerCase();
    for (const token of forbidden) {
      expect(haystack, `${file} names "${token}"`).not.toContain(token);
    }
  });

  it('the manifest names none either', () => {
    const haystack = readFileSync(
      join(mealPlanDir, 'kit.json'),
      'utf-8'
    ).toLowerCase();
    for (const token of forbidden) {
      expect(haystack, `kit.json names "${token}"`).not.toContain(token);
    }
  });
});

// What %kits writes into the group blob at install, read back through the
// parser every client and the harness share. The Hoon side asserts the cards;
// this asserts the payload's shape is what a reader expects.
describe('the descriptor a meal-plan install writes', () => {
  const host = '~sampel-palnet';
  const blob = JSON.stringify({
    version: 1,
    kits: [
      {
        installId: 'meal-plan-0',
        kit: {
          id: kit.manifest.id,
          version: kit.manifest.kitVersion,
          publisher: kit.manifest.publisher,
        },
        places: {
          kitchen: `chat/${host}/kitchen-house`,
          plans: `notes/${host}/plans-house`,
        },
        schedules: kit.manifest.schedules.map((s) => ({
          id: s.id,
          cron: s.cron,
          enabled: false,
        })),
        agents: [host],
        setup: 'pending',
        installedAt: 1786149333904,
      },
    ],
  });

  it('records both places, including the notes-backed one', () => {
    const entry = parseGroupKitConfig(blob)?.kits[0];
    expect(entry?.places.kitchen).toBe(`chat/${host}/kitchen-house`);
    expect(entry?.places.plans).toBe(`notes/${host}/plans-house`);
  });

  it('records the kit identity and a pending setup', () => {
    const entry = parseGroupKitConfig(blob)?.kits[0];
    expect(entry?.kit).toEqual({
      id: 'meal-plan',
      version: '0.1.0',
      publisher: kit.manifest.publisher,
    });
    expect(entry?.setup).toBe('pending');
  });

  // AC #4. The schedule is visible so it can be offered later, and inactive so
  // nothing fires before the household agrees to it.
  it('records the schedule declared but not enabled', () => {
    const schedules = parseGroupKitConfig(blob)?.kits[0]?.schedules;
    expect(schedules).toEqual([
      { id: 'weekly-plan', cron: '0 17 * * 5', enabled: false },
    ]);
  });

  // A descriptor written before `enabled` existed described a schedule nothing
  // was firing. Reading it as active would start one the household never
  // agreed to, so the default has to be false.
  it('treats a schedule with no enabled field as not enabled', () => {
    const older = JSON.stringify({
      version: 1,
      kits: [
        {
          installId: 'meal-plan-0',
          kit: {
            id: 'meal-plan',
            version: '0.1.0',
            publisher: kit.manifest.publisher,
          },
          schedules: [{ id: 'weekly-plan', cron: '0 17 * * 5' }],
        },
      ],
    });
    expect(parseGroupKitConfig(older)?.kits[0]?.schedules[0]).toEqual({
      id: 'weekly-plan',
      cron: '0 17 * * 5',
      enabled: false,
    });
  });
});
