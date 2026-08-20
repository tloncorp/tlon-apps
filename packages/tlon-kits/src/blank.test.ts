import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { toWireKit } from './index.js';
import { loadKit } from './loader.js';

const blankDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'kits',
  'blank'
);

const kit = loadKit(blankDir);

describe('the blank kit', () => {
  // The id is a contract with provisioning: a user who picks no starter gets
  // this kit by id, and `DEFAULT_STARTER_KIT_ID` names it.
  it('is identified as blank', () => {
    expect(kit.manifest.id).toBe('blank');
    expect(kit.manifest.scope).toBe('group');
  });

  it('validates and round-trips to the wire shape', () => {
    const wire = toWireKit(kit);
    expect(wire.manifest.id).toBe('blank');
    expect(wire.manifest.places.map((p) => p.name).sort()).toEqual([
      'conversation',
      'notes',
    ]);
  });

  // The reason this kit exists at all. TASK-8 defines a workspace as a group
  // carrying a kit install, so the "Something else" path needs *a* kit or it
  // gets a group that is not a workspace. What it must not have is content that
  // presumes a domain.
  it('has a conversation and a notes-backed artifact place', () => {
    expect(kit.manifest.places.conversation.type).toBe('chat');
    expect(kit.manifest.places.notes.type).toBe('notes');
  });

  // Nothing recurs in a workspace whose purpose is unknown, so there is nothing
  // to schedule. A schedule here would fire an instruction with no subject.
  it('declares no schedules and no scaffolds', () => {
    expect(kit.manifest.schedules).toEqual([]);
    expect(kit.manifest.scaffolds).toEqual([]);
  });

  it('binds an ambient runner and an install-triggered setup', () => {
    const byTrigger = new Map(
      kit.manifest.bindings.map((b) => [b.trigger ?? 'ambient', b])
    );
    expect(byTrigger.get('ambient')?.file).toBe('instructions/runner.md');
    expect(byTrigger.get('install.setup')?.file).toBe('instructions/setup.md');
  });

  it('ships every file its bindings name', () => {
    for (const binding of kit.manifest.bindings) {
      expect(kit.files[binding.file], binding.file).toBeTruthy();
    }
  });

  // doc-1 §5 again, and harder here than for meal-plan: with no domain to
  // propose within, the temptation is to open with "what would you like to do?"
  // — which is the questionnaire the whole product thesis rejects.
  it('tells setup not to open with questions', () => {
    const setup = kit.files['instructions/setup.md'];
    expect(setup).toMatch(/Do not open with questions/);
    expect(setup).toMatch(
      /Do not ask what they want to use this for before offering anything/
    );
    expect(setup).toMatch(/Do not list what you can do/);
  });

  // An empty artifact place reads as broken. The first note is what makes the
  // notebook look like a beginning rather than a failure.
  it('tells setup to leave one note behind', () => {
    expect(kit.files['instructions/setup.md']).toMatch(/Write one note/);
  });

  it('keeps setup away from the schedule question', () => {
    expect(kit.files['instructions/setup.md']).toMatch(
      /Do not ask about schedules/
    );
  });
});

// Same property as meal-plan: a kit is markdown loaded into whatever model is
// configured, so naming a provider would bake a deployment choice into shared
// content.
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
      join(blankDir, 'kit.json'),
      'utf-8'
    ).toLowerCase();
    for (const token of forbidden) {
      expect(haystack, `kit.json names "${token}"`).not.toContain(token);
    }
  });
});
