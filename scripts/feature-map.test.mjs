import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkEntry,
  checkLooseLabels,
  extractLabels,
  labelInSources,
  normalize,
  parseMapFile,
  readSurface,
  replaceIndex,
  slugify,
} from './feature-map.mjs';

/** A reader over an in-memory tree, with a fixed set of terms `grep` finds. */
function fakeReader(files, found = {}) {
  return {
    read: (file) => files[file] ?? null,
    grep: (term) => found[term] ?? [],
    list: () => Object.keys(files),
  };
}

const MAP = `# Workspaces list

Finding and pinning chats.
More intro.

## Pin or unpin a chat
<!-- src: app/Options.tsx, app/List.tsx -->
<!-- covers: route:ChatList,
     action:pinPost -->

Phone: press and hold, then tap \`Pin\`. Undo with \`Unpin\`.

\`\`\`
## not a heading, and \`not a label\`
\`\`\`

## Mark a chat unread
<!-- absent: mark as unread -->
<!-- flag: someFlag -->

Notes: the app can't do this.
`;

test('parses the title, intro, entries and their anchors', () => {
  const file = parseMapFile(MAP, 'workspaces-list.md');
  assert.equal(file.title, 'Workspaces list');
  assert.equal(file.intro, 'Finding and pinning chats.\nMore intro.');
  assert.deepEqual(
    file.entries.map((entry) => entry.heading),
    ['Pin or unpin a chat', 'Mark a chat unread']
  );
  const [pin, unread] = file.entries;
  assert.deepEqual(pin.src, ['app/Options.tsx', 'app/List.tsx']);
  assert.deepEqual(pin.covers, ['route:ChatList', 'action:pinPost']);
  assert.deepEqual(pin.labels, ['Pin', 'Unpin']);
  assert.ok(!pin.body.includes('<!--'));
  assert.deepEqual(unread.absent, ['mark as unread']);
  assert.deepEqual(unread.flag, ['someFlag']);
});

test('ignores code fences when collecting labels', () => {
  assert.deepEqual(extractLabels('Tap `Go`.\n```\n`skipped`\n```\n'), ['Go']);
});

test('slugs survive punctuation and quotes', () => {
  assert.equal(
    slugify("What's in the `Pinned` section?"),
    'whats-in-the-pinned-section'
  );
});

test('matches labels split across lines or written with escapes', () => {
  const sources = [
    normalize(`<Text>\n  Group info\n  &amp; settings\n</Text>`),
    normalize(`title: 'Don\\'t allow'`),
    normalize(`<Text>You&apos;re{' '}in</Text>`),
  ];
  assert.ok(labelInSources('Group info & settings', sources));
  assert.ok(labelInSources("Don't allow", sources));
  assert.ok(labelInSources("You're in", sources));
  assert.ok(labelInSources('Don’t allow', sources));
  assert.ok(!labelInSources('Group Info & Settings', sources));
});

test('checks a slash command by its name', () => {
  const sources = [normalize(`name: 'owner-listen',`)];
  assert.ok(labelInSources('/owner-listen all on', sources));
  assert.ok(!labelInSources('/mute', sources));
});

test('reports a missing file, a missing label and a present "absent" term', () => {
  const [pin, unread] = parseMapFile(MAP).entries;
  const reader = fakeReader(
    { 'app/Options.tsx': `title: isPinned ? 'Unpin' : 'Pinned'` },
    { 'mark as unread': ['app/Menu.tsx'] }
  );
  assert.deepEqual(checkEntry(pin, reader), [
    'cited file is missing: app/List.tsx',
    'label not in cited files: `Pin`',
  ]);
  assert.match(checkEntry(unread, reader)[0], /appears in app\/Menu\.tsx/);
});

test('passes an entry whose labels are all in its cited files', () => {
  const [pin] = parseMapFile(MAP).entries;
  const reader = fakeReader({
    'app/Options.tsx': `title: isPinned ? 'Unpin' : 'Pin'`,
    'app/List.tsx': '',
  });
  assert.deepEqual(checkEntry(pin, reader), []);
});

test('an entry needs a src or an absent anchor', () => {
  const [entry] = parseMapFile('# T\n\n## Bare\n\nTap `Go`.\n').entries;
  assert.deepEqual(checkEntry(entry, fakeReader({})), [
    'no `src:` or `absent:` anchor',
    'quotes labels but cites no files',
  ]);
});

test('reads screens, actions, flags and commands from their sources', () => {
  const reader = fakeReader({
    'packages/app/navigation/types.ts': `export type RootStackParamList = {
  ChatList: undefined;
  Channel: {
    channelId: string;
    Nested: never;
  };
  Optional?: { id: string };
};
type Other = {
  NotARoute: undefined;
};
export type CombinedParamList = RootStackParamList & Other;
`,
    'packages/api/src/types/ChannelActions.ts': `export type Id =\n  | 'quote'\n  | 'edit';\nconst other = 'nope';`,
    'packages/app/lib/featureFlags.ts': `export const featureMeta = {\n  buckets: {\n    default: false,\n  },\n} satisfies Record<string, unknown>;`,
    'packages/openclaw/src/commands-registry.ts': `  {\n    name: 'allow',\n  },\nexport const CORE_COMMAND_TOKENS = ['/help', '/new'];`,
  });
  assert.deepEqual(readSurface(reader), {
    items: [
      'action:edit',
      'action:quote',
      'command:allow',
      'command:help',
      'command:new',
      'flag:buckets',
      'route:Channel',
      'route:ChatList',
      'route:Optional',
    ],
    missingSources: [],
  });
});

test('says so when a surface source cannot be read', () => {
  assert.equal(readSurface(fakeReader({})).missingSources.length, 4);
});

test('the loose check skips paths, ships and placeholders', () => {
  const text =
    'Tap `Share link`, run `/pending`, see `chat/~host/name`, `~sampel-palnet`, `<name> is on Tlon`, `New thing`.';
  const reader = fakeReader({}, { 'Share link': ['a.tsx'], pending: ['b.ts'] });
  assert.deepEqual(checkLooseLabels(text, reader), ['New thing']);
});

test('rewrites only the index block', () => {
  const skill =
    'before\n<!-- feature-map:index:start -->\nold\n<!-- feature-map:index:end -->\nafter\n';
  assert.equal(
    replaceIndex(skill, '- new'),
    'before\n<!-- feature-map:index:start -->\n- new\n<!-- feature-map:index:end -->\nafter\n'
  );
  assert.equal(replaceIndex('no markers', '- new'), null);
});
