import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  affectedEntries,
  checkEntry,
  checkLooseLabels,
  checkMap,
  checkQuestions,
  extractLabels,
  flagLeaks,
  labelInSources,
  normalize,
  parseMapFile,
  publishedFiles,
  questionAnchors,
  readSurface,
  recordedBuild,
  renderAffected,
  replaceIndex,
  slugify,
} from './feature-map.mjs';

/** A reader over an in-memory tree, with a fixed set of terms `grep` finds. */
function fakeReader(files, found = {}) {
  return {
    read: (file) => files[file] ?? null,
    grep: (term) => found[term] ?? [],
    list: (dir) =>
      Object.keys(files)
        .filter((file) => file.startsWith(`${dir}/`))
        .map((file) => file.slice(dir.length + 1))
        .filter((name) => !name.includes('/')),
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

test('finds a flagged feature talked about in an entry without the flag', () => {
  const words = [['buckets', ['Bucket', 'Buckets']]];
  assert.deepEqual(
    flagLeaks(
      'Leave a channel\nWho: anyone. A Bucket can not be left.',
      [],
      words
    ),
    [{ flag: 'buckets', word: 'Bucket' }]
  );
  // The entry carries the flag, so promote holds it back with the feature.
  assert.deepEqual(
    flagLeaks('Phone: open the Bucket.', ['buckets'], words),
    []
  );
  // A quoted label is on screen whatever the flag says; a storage bucket is
  // another thing.
  assert.deepEqual(
    flagLeaks(
      'Phone: flip `Enable Buckets channels`.\n<!-- absent: Buckets -->\nNotes: your own bucket.',
      [],
      words
    ),
    []
  );
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
export type ActivityDrawerParamList = Pick<
  RootStackParamList,
  'ChatList'
> & {
  ActivityEmpty: undefined;
};
export type HomeDrawerParamList = Pick<RootStackParamList, 'ChatList'> &
  Pick<RootStackParamList, 'Channel'> & {
    MainContent: undefined;
    Wrapped:
      | { inner: { Deep: never } }
      | RootStackParamList['Channel'];
  };
export type ChannelStackParamList = Pick<
  RootStackParamList,
  'ChatList'
> & { ChannelRoot: RootStackParamList['Channel']; Beside?: { Inner: never } };
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
      'route:ActivityEmpty',
      'route:Beside',
      'route:Channel',
      'route:ChannelRoot',
      'route:ChatList',
      'route:MainContent',
      'route:Optional',
      'route:Wrapped',
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

const QUESTIONS = `# comment
- id: pin-chat
  ask: how do i keep a chat at the top?
  kind: how-to
  file: workspaces-list.md
  entry: Pin or unpin a chat
  must:
    - entry: not a field at this depth
- id: quoted
  file: 'workspaces-list.md'
  entry: "What's in the list: rows"  # trailing comment
- id: concept
  ask: what is a node?
  must: [x]
`;

test('reads question anchors without a YAML parser', () => {
  assert.deepEqual(questionAnchors(QUESTIONS), [
    {
      id: 'pin-chat',
      file: 'workspaces-list.md',
      entry: 'Pin or unpin a chat',
    },
    {
      id: 'quoted',
      file: 'workspaces-list.md',
      entry: "What's in the list: rows",
    },
    { id: 'concept' },
  ]);
});

test('flags a question whose entry is not in the map', () => {
  const reader = fakeReader({
    'docs/feature-map/questions/core.yaml': QUESTIONS,
  });
  const files = [parseMapFile(MAP, 'workspaces-list.md')];
  assert.deepEqual(checkQuestions(reader, files), [
    {
      file: 'questions/core.yaml',
      entry: 'quoted',
      problem: 'no entry "What\'s in the list: rows" in workspaces-list.md',
    },
  ]);
});

const entry = (heading, label, extra = '') =>
  `## ${heading}\n<!-- src: app/Menu.tsx -->\n${extra}\nPhone: tap \`${label}\`.\n`;
const mapOf = (...entries) => [
  parseMapFile(
    `# Lists\n\nFinding chats.\n\n${entries.join('\n')}`,
    'lists.md'
  ),
];

test('checks the map in this checkout against the source of the build', () => {
  const map = fakeReader({
    'docs/feature-map/lists.md': `# Lists\n\nFinding chats.\n\n${entry('Pin a chat', 'Pin', '<!-- covers: route:ChatList -->')}\n${entry('Keep a chat', 'Keep')}`,
    'docs/feature-map/surface-ignore.txt':
      'action:quote # not worth an entry\n',
  });
  // The build has `Pin`. `Keep` is what develop renamed it to afterwards.
  const code = fakeReader({
    'app/Menu.tsx': `title: 'Pin'`,
    'packages/app/navigation/types.ts': `export type RootStackParamList = {\n  ChatList: undefined;\n};\n`,
    'packages/api/src/types/ChannelActions.ts': `export type Id =\n  | 'quote';`,
    'packages/app/lib/featureFlags.ts': `export const featureMeta = {\n  quiet: {\n    default: false,\n  },\n} satisfies Record<string, unknown>;`,
    'packages/openclaw/src/commands-registry.ts': `export const CORE_COMMAND_TOKENS = ['/help'];`,
  });
  const problems = checkMap(map, code).failures.map(
    (failure) => `${failure.entry ?? failure.file}: ${failure.problem}`
  );
  assert.equal(problems.length, 3);
  assert.equal(problems[0], 'Keep a chat: label not in cited files: `Keep`');
  assert.match(problems[1], /command:help is not covered by any entry/);
  assert.match(problems[2], /flag:quiet is not covered by any entry/);
});

test('publishes the map without the entries for a feature that is switched off', () => {
  const mapFiles = [
    ...mapOf(
      entry('Pin a chat', 'Pin'),
      entry('Mute a chat', 'Mute', '<!-- flag: quiet -->')
    ),
    parseMapFile(
      `# Drafts\n\nNot ready.\n\n${entry('Schedule a chat', 'Later', '<!-- flag: quiet -->')}`,
      'later.md'
    ),
  ];
  const headings = (result) =>
    result.published.map((item) => [
      item.name,
      item.entries.map((each) => each.heading),
    ]);

  const off = publishedFiles(mapFiles, new Set());
  // A file with nothing left to say is not published at all.
  assert.deepEqual(headings(off), [['lists.md', ['Pin a chat']]]);
  assert.deepEqual(off.leftOut, [
    { file: 'lists.md', entry: 'Mute a chat', flag: 'quiet' },
    { file: 'later.md', entry: 'Schedule a chat', flag: 'quiet' },
  ]);

  const on = publishedFiles(mapFiles, new Set(['quiet']));
  assert.deepEqual(headings(on), [
    ['lists.md', ['Pin a chat', 'Mute a chat']],
    ['later.md', ['Schedule a chat']],
  ]);
  assert.deepEqual(on.leftOut, []);
});

test('reads which build the map describes', () => {
  const build = { app: 'ios-production-1', commit: 'abc123' };
  assert.deepEqual(
    recordedBuild(
      fakeReader({ 'docs/feature-map/release.json': JSON.stringify(build) })
    ),
    build
  );
  assert.throws(
    () => recordedBuild(fakeReader({})),
    /release\.json is missing/
  );
});

test('lists the entries that cite a file that changed between two builds', () => {
  const mapFiles = mapOf(
    entry('Pin a chat', 'Pin'),
    entry('Mute a chat', 'Mute'),
    '## Leave a chat\n<!-- src: app/Leave.tsx -->\n\nPhone: tap `Leave`.\n'
  );
  const result = affectedEntries({
    mapFiles,
    changed: [
      { status: 'M', file: 'app/Menu.tsx', lines: 12 },
      { status: 'A', file: 'packages/app/ui/NewSheet.tsx', lines: 80 },
      { status: 'A', file: 'packages/app/ui/NewSheet.test.tsx', lines: 40 },
      { status: 'A', file: 'packages/app/test/sheetUtils.tsx', lines: 9 },
      { status: 'M', file: 'packages/shared/src/logic/roles.ts', lines: 3 },
      { status: 'D', file: 'packages/app/ui/Gone.tsx', lines: 50 },
      { status: 'M', file: 'README.md', lines: 1 },
    ],
  });
  assert.deepEqual(result.entries, [
    { file: 'lists.md', entry: 'Pin a chat' },
    { file: 'lists.md', entry: 'Mute a chat' },
  ]);
  assert.deepEqual(result.files, [
    { file: 'app/Menu.tsx', lines: 12, entries: 2 },
  ]);
  // Tests, deleted files and files outside the app are not worth a look.
  assert.deepEqual(result.added, ['packages/app/ui/NewSheet.tsx']);
  assert.equal(result.otherUncited, 1);

  const text = renderAffected(result, 'between `a` and `b`');
  assert.match(text, /Entries to re-read: 2/);
  assert.match(text, /^- Pin a chat$/m);
  assert.match(text, /^- `app\/Menu.tsx`: 12 lines, 2 entries$/m);
  assert.match(text, /1 other changed source file cited by no entry/);
});

test('says so when nothing on the list changed', () => {
  const result = affectedEntries({
    mapFiles: mapOf(entry('Pin a chat', 'Pin')),
    changed: [{ status: 'M', file: 'docs/notes.md', lines: 4 }],
  });
  assert.deepEqual(result, {
    entries: [],
    files: [],
    added: [],
    otherUncited: 0,
  });
  assert.equal(
    renderAffected(result, 'between `a` and `b`'),
    'No entry cites a file that changed between `a` and `b`.'
  );
});
