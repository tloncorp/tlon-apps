import type { Kit } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import {
  PENDING_PLACE,
  buildKitAmbientContext,
  findTriggerBindingContent,
  formatPlacesLegend,
  resolveKitPlaces,
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
      places: [
        {
          name: 'discussion',
          kind: 'chat',
          title: 'Discussion',
          description: 'talk',
        },
        { name: 'picks', kind: 'chat', title: 'Picks', description: 'vote' },
        {
          name: 'log',
          kind: 'notebook',
          title: 'Reading Log',
          description: 'record',
        },
      ],
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
    // Notebook places (log) are created via %notes and never appear here.
    places: {
      discussion: 'chat/~zod/discussion',
      picks: 'chat/~zod/picks',
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
      groupChannels: {
        'chat/~zod/discussion': 'Discussion',
        'notes/~zod/reading-log-4': 'Reading Log',
      },
    });
    expect(text).not.toBeNull();
    expect(text).toContain('Book Club (book-club v0.1.0)');
    expect(text).toContain(GROUP);
    expect(text).toContain('discussion → chat/~zod/discussion');
    expect(text).toContain('picks → chat/~zod/picks');
    expect(text).toContain('log → notes/~zod/reading-log-4');
    expect(text).toContain('--- instructions/runner.md ---');
    expect(text).toContain('# Run the club');
  });

  it('renders unresolvable notebook places as pending', () => {
    const text = buildKitAmbientContext({
      groupFlag: GROUP,
      entry: makeEntry(),
      kit: makeKit(),
    });
    expect(text).toContain(`log → ${PENDING_PLACE}`);
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
        gallery: 'heap/~zod/gallery',
        picks: 'chat/~zod/picks',
      })
    ).toBe('chat/~zod/picks');
  });

  it('returns null when there is no chat place', () => {
    expect(
      resolvePrimaryPlaceNest({ gallery: 'heap/~zod/gallery' })
    ).toBeNull();
    expect(resolvePrimaryPlaceNest({})).toBeNull();
  });
});

describe('resolveKitPlaces', () => {
  const manifestPlaces = makeKit().manifest.places;
  const configPlaces = makeEntry().places;

  it('resolves notebook places from group channels by title', () => {
    expect(
      resolveKitPlaces({
        manifestPlaces,
        configPlaces,
        groupChannels: {
          'chat/~zod/discussion': 'Discussion',
          'notes/~zod/reading-log-4': 'Reading Log',
          'notes/~zod/other-7': 'Other',
        },
      })
    ).toEqual({
      discussion: 'chat/~zod/discussion',
      picks: 'chat/~zod/picks',
      log: 'notes/~zod/reading-log-4',
    });
  });

  it('falls back to the sole notes channel when titles do not match', () => {
    expect(
      resolveKitPlaces({
        manifestPlaces,
        configPlaces,
        groupChannels: { 'notes/~zod/renamed-9': 'Renamed' },
      })
    ).toMatchObject({ log: 'notes/~zod/renamed-9' });
  });

  it('renders pending when no notes channel resolves', () => {
    expect(
      resolveKitPlaces({ manifestPlaces, configPlaces, groupChannels: null })
    ).toMatchObject({ log: PENDING_PLACE });
    expect(
      resolveKitPlaces({
        manifestPlaces,
        configPlaces,
        groupChannels: {
          'notes/~zod/a-1': 'A',
          'notes/~zod/b-2': 'B',
        },
      })
    ).toMatchObject({ log: PENDING_PLACE });
  });

  it('keeps config places the manifest does not name', () => {
    expect(
      resolveKitPlaces({
        manifestPlaces: [],
        configPlaces: { extra: 'chat/~zod/extra' },
      })
    ).toEqual({ extra: 'chat/~zod/extra' });
  });
});

describe('formatPlacesLegend', () => {
  it('renders name → nest pairs', () => {
    expect(formatPlacesLegend({ a: 'chat/~zod/a', b: 'diary/~zod/b' })).toBe(
      'a → chat/~zod/a, b → diary/~zod/b'
    );
  });
});
