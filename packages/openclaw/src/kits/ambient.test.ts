import type { Kit } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import {
  buildKitAmbientContext,
  findTriggerBindingContent,
  formatPlacesLegend,
  resolvePrimaryPlaceNest,
} from './ambient.js';
import type { InstalledKitConfig } from './group-config.js';

const GROUP = '~zod/book-club';

function makeKit(): Kit {
  return {
    manifest: {
      id: 'book-club',
      name: 'Book Club',
      version: '0.1.0',
      publisher: '~zod',
      description: 'a club',
      image: null,
      scope: 'group',
      places: [],
      bindings: [
        {
          file: 'instructions/runner.md',
          scope: 'group',
          trigger: null,
          load: 'ambient',
        },
        {
          file: 'instructions/dm-notes.md',
          scope: 'dm',
          trigger: null,
          load: 'ambient',
        },
        {
          file: 'instructions/setup.md',
          scope: 'group',
          trigger: 'install.setup',
          load: 'on-trigger',
        },
        {
          file: 'instructions/monthly-pick.md',
          scope: 'group',
          trigger: 'schedule.monthly-pick',
          load: 'on-trigger',
        },
        {
          file: 'instructions/lore.md',
          scope: 'group',
          trigger: null,
          load: 'pulled',
        },
      ],
      schedules: [],
      scaffolds: [],
      policy: null,
    },
    files: {
      'instructions/runner.md': '# Run the club',
      'instructions/dm-notes.md': '# DM behavior',
      'instructions/setup.md': '# Setup conversation',
      'instructions/monthly-pick.md': '# Pick a book',
      'instructions/lore.md': '# Deep lore',
    },
  };
}

function makeEntry(): InstalledKitConfig {
  return {
    installId: 'book-club-0',
    kit: { id: 'book-club', version: '0.1.0', publisher: '~zod' },
    places: {
      discussion: 'chat/~zod/discussion',
      picks: 'chat/~zod/picks',
      log: 'diary/~zod/log',
    },
    schedules: [{ id: 'monthly-pick', cron: '0 17 1 * *' }],
    agents: ['~zod'],
    setup: 'pending',
  };
}

describe('buildKitAmbientContext', () => {
  it('injects group-scoped ambient files with header and places legend', () => {
    const text = buildKitAmbientContext({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
    });
    expect(text).not.toBeNull();
    expect(text).toContain('Book Club (book-club v0.1.0)');
    expect(text).toContain(GROUP);
    expect(text).toContain('discussion → chat/~zod/discussion');
    expect(text).toContain('picks → chat/~zod/picks');
    expect(text).toContain('--- instructions/runner.md ---');
    expect(text).toContain('# Run the club');
  });

  it('excludes on-trigger, pulled, and non-group-scope instructions', () => {
    const text = buildKitAmbientContext({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
    });
    expect(text).not.toContain('# Setup conversation');
    expect(text).not.toContain('# Pick a book');
    expect(text).not.toContain('# Deep lore');
    expect(text).not.toContain('# DM behavior');
  });

  it('returns null when the kit has no ambient group instructions', () => {
    const kit = makeKit();
    kit.manifest.bindings = kit.manifest.bindings.filter(
      (binding) => binding.load !== 'ambient'
    );
    expect(
      buildKitAmbientContext({ groupFlag: GROUP, entry: makeEntry(), kit })
    ).toBeNull();
  });

  it('skips ambient bindings whose file is missing from the package', () => {
    const kit = makeKit();
    delete kit.files['instructions/runner.md'];
    expect(
      buildKitAmbientContext({ groupFlag: GROUP, entry: makeEntry(), kit })
    ).toBeNull();
  });
});

describe('findTriggerBindingContent', () => {
  it('finds on-trigger content by trigger name', () => {
    expect(findTriggerBindingContent(makeKit(), 'install.setup')).toBe(
      '# Setup conversation'
    );
    expect(findTriggerBindingContent(makeKit(), 'schedule.monthly-pick')).toBe(
      '# Pick a book'
    );
  });

  it('returns null for unknown triggers', () => {
    expect(findTriggerBindingContent(makeKit(), 'schedule.nope')).toBeNull();
  });
});

describe('resolvePrimaryPlaceNest', () => {
  it('prefers the discussion place', () => {
    expect(resolvePrimaryPlaceNest(makeEntry().places)).toBe(
      'chat/~zod/discussion'
    );
  });

  it('falls back to the first chat place', () => {
    expect(
      resolvePrimaryPlaceNest({
        log: 'diary/~zod/log',
        picks: 'chat/~zod/picks',
      })
    ).toBe('chat/~zod/picks');
  });

  it('returns null when there is no chat place', () => {
    expect(resolvePrimaryPlaceNest({ log: 'diary/~zod/log' })).toBeNull();
    expect(resolvePrimaryPlaceNest({})).toBeNull();
  });
});

describe('formatPlacesLegend', () => {
  it('renders name → nest pairs', () => {
    expect(formatPlacesLegend({ a: 'chat/~zod/a', b: 'diary/~zod/b' })).toBe(
      'a → chat/~zod/a, b → diary/~zod/b'
    );
  });
});
