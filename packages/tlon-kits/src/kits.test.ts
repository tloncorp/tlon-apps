import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  kitManifestSchema,
  loadAllKits,
  loadKit,
  toWireKit,
  wireKitSchema,
} from './index.js';

const bookClubDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'kits',
  'book-club'
);

describe('loadKit', () => {
  it('loads and validates the book-club kit', () => {
    const kit = loadKit(bookClubDir);

    expect(kit.manifest.version).toBe(1);
    expect(kit.manifest.id).toBe('book-club');
    expect(kit.manifest.kitVersion).toBe('0.1.0');
    expect(kit.manifest.scope).toBe('group');
    expect(kit.manifest.places.discussion).toMatchObject({
      type: 'chat',
      title: 'Discussion',
    });
    expect(kit.manifest.places.log.type).toBe('notebook');
    expect(kit.manifest.bindings).toHaveLength(4);
    expect(kit.manifest.policy?.required).toHaveLength(2);
  });

  it('collects instructions, scaffolds, and card files by package path', () => {
    const kit = loadKit(bookClubDir);

    expect(Object.keys(kit.files).sort()).toEqual([
      'card/summary.md',
      'instructions/monthly-pick.md',
      'instructions/runner.md',
      'instructions/setup.md',
      'instructions/weekly-nudge.md',
      'scaffolds/Profile.md',
      'scaffolds/Reading Log.md',
    ]);
    expect(kit.files['instructions/runner.md'].length).toBeGreaterThan(0);
  });

  it('throws on a directory without kit.json', () => {
    expect(() => loadKit(join(bookClubDir, 'instructions'))).toThrow(
      /No kit\.json found/
    );
  });
});

describe('loadAllKits', () => {
  it('finds the packaged book-club kit', () => {
    const kits = loadAllKits();
    expect(kits.map((kit) => kit.manifest.id)).toContain('book-club');
  });
});

describe('toWireKit', () => {
  const kit = loadKit(bookClubDir);
  const wire = toWireKit(kit);

  it('produces a wire kit that satisfies the wire schema', () => {
    expect(() => wireKitSchema.parse(wire)).not.toThrow();
  });

  it('converts the places map to a list of {name, kind, title, description}', () => {
    expect(wire.manifest.places).toEqual([
      {
        name: 'discussion',
        kind: 'chat',
        title: 'Discussion',
        description: 'Talk about the current book',
      },
      {
        name: 'picks',
        kind: 'chat',
        title: 'Picks',
        description: 'Propose and vote on what to read next',
      },
      {
        name: 'log',
        kind: 'notebook',
        title: 'Reading Log',
        description: "The club's record: current book, past reads, notes",
      },
    ]);
  });

  it('maps kitVersion to wire version', () => {
    expect(wire.manifest.version).toBe('0.1.0');
  });

  it('stringifies the policy object', () => {
    expect(typeof wire.manifest.policy).toBe('string');
    const policy = JSON.parse(wire.manifest.policy as string);
    expect(policy.required).toHaveLength(2);
    expect(policy.recommended).toHaveLength(1);
  });

  it('uses explicit nulls for absent triggers (the mark requires the key)', () => {
    const ambient = wire.manifest.bindings.find(
      (binding) => binding.file === 'instructions/runner.md'
    );
    expect(ambient).toBeDefined();
    expect(ambient?.trigger).toBeNull();

    const triggered = wire.manifest.bindings.find(
      (binding) => binding.file === 'instructions/setup.md'
    );
    expect(triggered?.trigger).toBe('install.setup');
  });

  it('carries every package file in the files map', () => {
    expect(wire.files['instructions/runner.md']).toBe(
      kit.files['instructions/runner.md']
    );
    expect(wire.files['card/summary.md']).toBe(kit.files['card/summary.md']);
    expect(Object.keys(wire.files)).toHaveLength(7);
  });

  it('maps an absent image and policy to null', () => {
    const bare = kitManifestSchema.parse({
      version: 1,
      id: 'bare-kit',
      name: 'Bare Kit',
      kitVersion: '1.0.0',
      publisher: '~zod',
      description: 'A kit with no optional fields.',
      scope: 'agent',
      places: {},
      bindings: [],
      schedules: [],
      scaffolds: [],
    });
    const bareWire = toWireKit({ manifest: bare, files: {} });
    expect(bareWire.manifest.image).toBeNull();
    expect(bareWire.manifest.policy).toBeNull();
  });
});

describe('kitManifestSchema', () => {
  it('rejects invalid scope and place types', () => {
    const kit = loadKit(bookClubDir);
    expect(() =>
      kitManifestSchema.parse({ ...kit.manifest, scope: 'planet' })
    ).toThrow();
    expect(() =>
      kitManifestSchema.parse({
        ...kit.manifest,
        places: { spot: { type: 'diary', title: 't', description: 'd' } },
      })
    ).toThrow();
  });

  it('rejects non-term place names', () => {
    const kit = loadKit(bookClubDir);
    expect(() =>
      kitManifestSchema.parse({
        ...kit.manifest,
        places: {
          'Not A Term': { type: 'chat', title: 't', description: 'd' },
        },
      })
    ).toThrow();
  });
});
