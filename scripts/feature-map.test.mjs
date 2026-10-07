import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  affectedEntries,
  checkEntry,
  checkQuestions,
  checkLooseLabels,
  extractLabels,
  labelInSources,
  normalize,
  parseMapFile,
  planRelease,
  questionAnchors,
  readSurface,
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
      'route:Channel',
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

// The release has `Pin` and `Mute`; develop has since renamed Pin to `Keep`.
const RELEASE = fakeReader({
  'app/Menu.tsx': `title: 'Pin'\ntitle: 'Mute'`,
});
const DEVELOP = fakeReader({
  'app/Menu.tsx': `title: 'Keep'\ntitle: 'Mute'`,
});
const entry = (heading, label, extra = '') =>
  `## ${heading}\n<!-- src: app/Menu.tsx -->\n${extra}\nPhone: tap \`${label}\`.\n`;
const mapOf = (...entries) => [
  parseMapFile(
    `# Lists\n\nFinding chats.\n\n${entries.join('\n')}`,
    'lists.md'
  ),
];
const publishedCopy = (...entries) => ({
  'lists.md': parseMapFile(
    `# Lists\n\nFinding chats.\n\n${entries.map(([heading, body]) => `## ${heading}\n\n${body}`).join('\n\n')}\n`,
    'lists.md'
  ),
});
const anchor = (label) => ({
  src: ['app/Menu.tsx'],
  labels: [label],
  absent: [],
  flag: [],
});
const plan = (input) =>
  planRelease({
    release: RELEASE,
    current: DEVELOP,
    flagsOn: new Set(),
    ...input,
  });
const headings = (result) =>
  result.published.flatMap((file) => file.entries.map((item) => item.heading));

test('publishes an entry that is true for the release, with its anchors', () => {
  const result = plan({
    mapFiles: mapOf(entry('Pin a chat', 'Pin')),
    previous: { files: {}, anchors: {} },
  });
  assert.deepEqual(headings(result), ['Pin a chat']);
  assert.deepEqual(result.published[0].entries[0].anchors, anchor('Pin'));
  assert.deepEqual(result.held, []);
});

test('falls back to the published copy only when that copy fits the release', () => {
  const mapFiles = mapOf(entry('Pin a chat', 'Keep'));
  const files = publishedCopy(['Pin a chat', 'Phone: tap `Pin`.']);

  const fits = plan({
    mapFiles,
    previous: { files, anchors: { 'lists.md#pin-a-chat': anchor('Pin') } },
  });
  assert.equal(fits.published[0].entries[0].body, 'Phone: tap `Pin`.');
  assert.equal(fits.held[0].kept, 'previous published copy');

  // Published for a newer build, then promoted for this older one.
  const tooNew = plan({
    mapFiles,
    previous: { files, anchors: { 'lists.md#pin-a-chat': anchor('Stick') } },
  });
  assert.deepEqual(headings(tooNew), []);
  assert.equal(tooNew.held[0].kept, 'left out');

  // A copy with no record of what it rested on cannot be trusted either.
  const unknown = plan({ mapFiles, previous: { files, anchors: {} } });
  assert.deepEqual(headings(unknown), []);
});

test('holds back an entry behind a flag that is off in the release', () => {
  const mapFiles = mapOf(entry('Mute a chat', 'Mute', '<!-- flag: quiet -->'));
  const previous = { files: {}, anchors: {} };
  assert.deepEqual(headings(plan({ mapFiles, previous })), []);
  assert.deepEqual(
    headings(plan({ mapFiles, previous, flagsOn: new Set(['quiet']) })),
    ['Mute a chat']
  );
});

test('keeps an entry the map dropped while the release still has the feature', () => {
  const previous = {
    files: publishedCopy(
      ['Pin a chat', 'Phone: tap `Pin`.'],
      ['Archive a chat', 'Phone: tap `Archive`.']
    ),
    anchors: {
      'lists.md#pin-a-chat': anchor('Pin'),
      'lists.md#archive-a-chat': anchor('Archive'),
    },
  };
  // Develop removed both features, so the map has neither entry.
  const result = plan({
    mapFiles: mapOf(entry('Mute a chat', 'Mute')),
    previous,
  });
  // Pin is still in the release; Archive is not.
  assert.deepEqual(headings(result), ['Mute a chat', 'Pin a chat']);
  assert.deepEqual(result.carried, [{ file: 'lists.md', entry: 'Pin a chat' }]);

  const dropped = plan({
    mapFiles: mapOf(entry('Mute a chat', 'Mute')),
    previous,
    drop: ['lists.md#pin-a-chat'],
  });
  assert.deepEqual(headings(dropped), ['Mute a chat']);
});

test('does not keep the old copy of an entry that was only renamed', () => {
  // Mute is still on develop, so its entry left the map by choice.
  const result = plan({
    mapFiles: mapOf(entry('Silence a chat', 'Mute')),
    previous: {
      files: publishedCopy(['Mute a chat', 'Phone: tap `Mute`, then wait.']),
      anchors: { 'lists.md#mute-a-chat': anchor('Mute') },
    },
  });
  assert.deepEqual(headings(result), ['Silence a chat']);
  assert.deepEqual(result.carried, []);
});

test('drops an entry that is still in the map, and refuses a drop that names nothing', () => {
  const input = {
    mapFiles: mapOf(entry('Pin a chat', 'Pin'), entry('Mute a chat', 'Mute')),
    previous: { files: {}, anchors: {} },
  };
  const result = plan({ ...input, drop: ['lists.md#pin-a-chat'] });
  assert.deepEqual(headings(result), ['Mute a chat']);
  assert.deepEqual(result.held, [
    {
      file: 'lists.md',
      entry: 'Pin a chat',
      kept: 'left out',
      why: ['dropped with --drop'],
    },
  ]);
  assert.throws(
    () => plan({ ...input, drop: ['lists.md#pin-chat'] }),
    /--drop names no entry: lists\.md#pin-chat/
  );
});

test('keeps a whole file the map dropped while its entries still fit', () => {
  const result = plan({
    mapFiles: [],
    previous: {
      files: publishedCopy(['Pin a chat', 'Phone: tap `Pin`.']),
      anchors: { 'lists.md#pin-a-chat': anchor('Pin') },
    },
  });
  assert.equal(result.published[0].name, 'lists.md');
  assert.equal(result.published[0].file.title, 'Lists');
  assert.deepEqual(headings(result), ['Pin a chat']);
});

test('lists the entries that cite a changed file, and says which were rewritten', () => {
  const before = mapOf(
    entry('Pin a chat', 'Pin'),
    entry('Mute a chat', 'Mute')
  );
  const mapFiles = mapOf(
    entry('Pin a chat', 'Pin'),
    entry('Mute a chat', 'Silence'),
    entry('Archive a chat', 'Archive'),
    '## Leave a chat\n<!-- src: app/Leave.tsx -->\n\nPhone: tap `Leave`.\n'
  );
  const result = affectedEntries({
    mapFiles,
    before,
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
    { file: 'lists.md', entry: 'Pin a chat', state: 'same' },
    { file: 'lists.md', entry: 'Mute a chat', state: 'edited' },
    { file: 'lists.md', entry: 'Archive a chat', state: 'new' },
  ]);
  assert.deepEqual(result.files, [
    { file: 'app/Menu.tsx', lines: 12, entries: 3 },
  ]);
  // Tests, deleted files and files outside the app are not worth a look.
  assert.deepEqual(result.added, ['packages/app/ui/NewSheet.tsx']);
  assert.equal(result.otherUncited, 1);

  const text = renderAffected(result, 'between `a` and `b`');
  assert.match(text, /Entries to re-read: 3/);
  assert.match(text, /1 of them kept the same text/);
  assert.match(text, /^- Pin a chat$/m);
  assert.match(text, /^- Mute a chat \(text changed too\)$/m);
  assert.match(text, /^- `app\/Menu.tsx`: 12 lines, 3 entries$/m);
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
