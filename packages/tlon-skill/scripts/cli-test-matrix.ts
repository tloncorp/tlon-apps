import { DIARY_REMOVED } from './cli-utils';

export const COMMAND_FAMILIES = [
  'activity',
  'channels',
  'contacts',
  'dms',
  'expose',
  'groups',
  'hooks',
  'messages',
  'notes',
  'posts',
  'settings',
  'upload',
] as const;

export const SUBCOMMAND_FAMILIES = COMMAND_FAMILIES.filter(
  (family) => family !== 'upload'
);

export type CliCase = {
  name: string;
  args: string[];
  expectedExitCode: number;
  stdout?: string;
  stderr?: string;
  stdoutIncludes?: string[];
  stderrIncludes?: string[];
  stdoutExcludes?: string[];
  stderrExcludes?: string[];
};

const SCRIPT_ERA_PATTERNS = [
  'npx ts-node',
  'Usage: activity.ts',
  'Usage: channels.ts',
  'Usage: contacts.ts',
  'Usage: dms.ts',
  'Usage: expose.ts',
  'Usage: groups.ts',
  'Usage: hooks.ts',
  'Usage: messages.ts',
  'Usage: posts.ts',
  'Usage: settings.ts',
  'Usage: upload.ts',
  'Example: activity.ts',
  'Example: channels.ts',
  'Example: contacts.ts',
  'Example: dms.ts',
  'Example: expose.ts',
  'Example: groups.ts',
  'Example: hooks.ts',
  'Example: messages.ts',
  'Example: posts.ts',
  'Example: settings.ts',
  'Example: upload.ts',
  'scripts/channels.ts',
  'scripts/contacts.ts',
  'scripts/dms.ts',
  'scripts/expose.ts',
  'scripts/groups.ts',
  'scripts/hooks.ts',
  'scripts/messages.ts',
  'scripts/posts.ts',
  'scripts/settings.ts',
];

const STACK_PATTERNS = [
  '\n    at ',
  '\n  at ',
  'api-client.ts:',
  'dist/tlon-run:',
  'error: Uncaught',
];

const AUTH_CONFIG_PATTERNS = [
  'Missing Urbit config',
  'Multiple cached ships',
  'Ship config not found',
  'Invalid config:',
  'Failed to parse config',
  'OpenClaw',
  'TLON_CONFIG_FILE',
  'TLON_CACHE_DIR',
  'Using cached credentials',
  'Credentials cached',
];

function helpCase(name: string, args: string[], usage: string): CliCase {
  return {
    name,
    args,
    expectedExitCode: 0,
    stderr: '',
    stdoutIncludes: ['Usage:', usage],
    stdoutExcludes: SCRIPT_ERA_PATTERNS,
  };
}

function usageErrorCase(
  name: string,
  args: string[],
  usage = 'Usage:'
): CliCase {
  return {
    name,
    args,
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: [usage],
    stderrExcludes: [
      ...SCRIPT_ERA_PATTERNS,
      ...STACK_PATTERNS,
      ...AUTH_CONFIG_PATTERNS,
    ],
  };
}

function authRequiredCase(name: string, args: string[]): CliCase {
  return {
    name,
    args,
    expectedExitCode: 1,
    stdoutExcludes: ['Usage:'],
    stderrIncludes: ['Missing Urbit config'],
    stderrExcludes: ['Usage:'],
  };
}

// A local, pre-auth refusal: empty stdout, `stderrSubstring` on stderr, and no
// Usage/auth/stack noise (it's a flat command error, not a usage or auth error).
function refusalCase(
  name: string,
  args: string[],
  stderrSubstring: string
): CliCase {
  return {
    name,
    args,
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: [stderrSubstring],
    stderrExcludes: ['Usage:', ...STACK_PATTERNS, ...AUTH_CONFIG_PATTERNS],
  };
}

// Every removed diary/notebook entry point must refuse with the shared
// DIARY_REMOVED message — locally, before any credential lookup.
function diaryRefusedCase(name: string, args: string[]): CliCase {
  return refusalCase(name, args, DIARY_REMOVED);
}

export const TOP_LEVEL_HELP_CASE = helpCase(
  'top-level --help',
  ['--help'],
  'tlon'
);

export const UNKNOWN_TOP_LEVEL_CASE: CliCase = {
  name: 'unknown top-level command',
  args: ['definitely-not-a-command'],
  expectedExitCode: 1,
  stdout: '',
  stderrIncludes: [
    'Unknown command: definitely-not-a-command',
    'Run "tlon --help" for usage information.',
  ],
  stderrExcludes: [...STACK_PATTERNS, ...AUTH_CONFIG_PATTERNS],
};

export const FAMILY_HELP_CASES: CliCase[] = COMMAND_FAMILIES.flatMap(
  (family) => [
    helpCase(`${family} --help`, [family, '--help'], `tlon ${family}`),
    helpCase(`${family} -h`, [family, '-h'], `tlon ${family}`),
  ]
);

export const FAMILY_BARE_CASES: CliCase[] = COMMAND_FAMILIES.map((family) =>
  usageErrorCase(`${family} bare invocation`, [family], `Usage: tlon ${family}`)
);

export const INVALID_SUBCOMMAND_CASES: CliCase[] = SUBCOMMAND_FAMILIES.map(
  (family) =>
    usageErrorCase(`${family} invalid subcommand`, [
      family,
      'definitely-not-a-subcommand',
    ])
);

export const MISSING_REQUIRED_CASES: CliCase[] = [
  usageErrorCase(
    'channels info missing nest',
    ['channels', 'info'],
    'Usage: tlon channels info'
  ),
  usageErrorCase(
    'contacts get missing ship',
    ['contacts', 'get'],
    'Usage: tlon contacts get'
  ),
  usageErrorCase(
    'dms send missing args',
    ['dms', 'send'],
    'Usage: tlon dms send'
  ),
  usageErrorCase(
    'expose show missing cite',
    ['expose', 'show'],
    'Usage: tlon expose show'
  ),
  usageErrorCase(
    'groups info missing id',
    ['groups', 'info'],
    'Usage: tlon groups info'
  ),
  usageErrorCase(
    'hooks init missing name',
    ['hooks', 'init'],
    'Usage: tlon hooks init'
  ),
  usageErrorCase(
    'messages dm missing ship',
    ['messages', 'dm'],
    'Usage: tlon messages dm'
  ),
  usageErrorCase(
    'posts react missing args',
    ['posts', 'react'],
    'Usage: tlon posts react'
  ),
  usageErrorCase(
    'posts send missing message',
    ['posts', 'send', 'chat/~host/channel'],
    'Usage: tlon posts send'
  ),
  usageErrorCase(
    'posts reply missing message',
    ['posts', 'reply', 'chat/~host/channel', '170.141'],
    'Usage: tlon posts reply'
  ),
  usageErrorCase(
    'posts reply missing author value',
    ['posts', 'reply', 'chat/~host/channel', '170.141', 'message', '--author'],
    'Usage: tlon posts reply'
  ),
  usageErrorCase(
    'posts send missing blob value',
    ['posts', 'send', 'chat/~host/channel', 'message', '--blob'],
    'Usage: tlon posts send'
  ),
  usageErrorCase(
    'posts send blob without message',
    ['posts', 'send', 'chat/~host/channel', '--blob', '[]'],
    'Usage: tlon posts send'
  ),
  {
    name: 'posts send blob rejects non-array json',
    args: [
      'posts',
      'send',
      'chat/~host/channel',
      'message',
      '--blob',
      '{"a":1}',
    ],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['--blob must be a JSON array'],
  },
  usageErrorCase(
    'posts send missing image value',
    ['posts', 'send', 'chat/~host/channel', 'message', '--image'],
    'Usage: tlon posts send'
  ),
  {
    name: 'posts send rejects non-http image url',
    args: ['posts', 'send', 'chat/~host/channel', '--image', 'ftp://x/y.png'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['--image must be an http(s) image URL'],
  },
  {
    name: 'posts send rejects non-http equals image url',
    args: ['posts', 'send', 'chat/~host/channel', '--image=ftp://x/y.png'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['--image must be an http(s) image URL'],
  },
  usageErrorCase(
    'dms send missing image value',
    ['dms', 'send', '0v5.abcde', '--image'],
    'Usage: tlon dms send'
  ),
  {
    name: 'dms send rejects non-http equals image url',
    args: ['dms', 'send', '0v5.abcde', '--image=ftp://x/y.png'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['--image must be an http(s) image URL'],
  },
  usageErrorCase(
    'settings set missing args',
    ['settings', 'set'],
    'Usage: tlon settings set'
  ),
  usageErrorCase('upload missing input', ['upload'], 'Usage: tlon upload'),
];

export const SPECIAL_INPUT_CASES: CliCase[] = [
  usageErrorCase(
    'activity unknown trailing arg',
    ['activity', 'mentions', 'extra'],
    'Unknown argument: extra'
  ),
  usageErrorCase(
    'activity missing limit value',
    ['activity', 'mentions', '--limit'],
    '--limit requires a value'
  ),
  usageErrorCase(
    'activity nonnumeric limit value',
    ['activity', 'mentions', '--limit', 'abc'],
    '--limit must be a positive integer'
  ),
  usageErrorCase(
    'contacts update-profile missing option value',
    ['contacts', 'update-profile', '--nickname'],
    'Usage: tlon contacts update-profile'
  ),
  usageErrorCase(
    'messages search missing query',
    ['messages', 'search', '--channel', 'chat/~host/slug'],
    'Usage: tlon messages search'
  ),
  usageErrorCase(
    'posts edit missing message',
    ['posts', 'edit', 'chat/~host/channel', '170.141'],
    'Usage: tlon posts edit'
  ),
  usageErrorCase(
    'groups update missing update option',
    ['groups', 'update', '~host/group-slug'],
    'At least one of --title, --description, --image, or --cover is required'
  ),
  usageErrorCase(
    'hooks init invalid type',
    ['hooks', 'init', 'my-hook', '--type', 'definitely-not-a-type'],
    'Invalid --type: definitely-not-a-type'
  ),
  usageErrorCase(
    'hooks init missing type value',
    ['hooks', 'init', 'my-hook', '--type'],
    'Usage: tlon hooks init'
  ),
  usageErrorCase(
    'hooks init type followed by known option',
    ['hooks', 'init', 'my-hook', '--type', '--out', 'hook.hoon'],
    'Usage: tlon hooks init'
  ),
  {
    ...usageErrorCase(
      'upload unknown option',
      ['upload', '--definitely-not-an-option'],
      'Unknown option: --definitely-not-an-option'
    ),
    stderrIncludes: [
      'Error: Unknown option: --definitely-not-an-option',
      'Usage: tlon upload',
    ],
  },
  usageErrorCase(
    'upload stdin with positional input',
    ['upload', '--stdin', 'photo.jpg'],
    '--stdin cannot be combined with a file or URL'
  ),
  usageErrorCase(
    'upload missing type value',
    ['upload', 'photo.jpg', '--type'],
    '--type requires a value'
  ),
  usageErrorCase(
    'channels create unknown kind',
    ['channels', 'create', '~host/group', 'Title', '--kind', 'foo'],
    'invalid --kind: foo'
  ),
  usageErrorCase(
    'groups add-channel unknown kind',
    ['groups', 'add-channel', '~host/group', 'Title', '--kind', 'foo'],
    'invalid --kind: foo'
  ),
  usageErrorCase(
    'channels create --kind without value',
    ['channels', 'create', '~host/group', 'Title', '--kind'],
    '--kind requires a value'
  ),
  usageErrorCase(
    'groups add-channel --kind without value',
    ['groups', 'add-channel', '~host/group', 'Title', '--kind'],
    '--kind requires a value'
  ),
  usageErrorCase(
    'channels create rejects --kind= equals form',
    ['channels', 'create', '~host/group', 'Title', '--kind=heap'],
    '--kind does not accept "=" form'
  ),
  usageErrorCase(
    'groups add-channel rejects --kind= equals form',
    ['groups', 'add-channel', '~host/group', 'Title', '--kind=heap'],
    '--kind does not accept "=" form'
  ),
];

export const NESTED_HELP_CASES: CliCase[] = [
  helpCase(
    'channels info --help',
    ['channels', 'info', '--help'],
    'Usage: tlon channels info'
  ),
  helpCase(
    'groups info --help',
    ['groups', 'info', '--help'],
    'Usage: tlon groups info'
  ),
  helpCase(
    'posts react --help',
    ['posts', 'react', '--help'],
    'Usage: tlon posts react'
  ),
  helpCase(
    'posts react --help with global credentials',
    [
      '--url',
      'https://cli.tlon.network',
      '--cookie',
      'urbauth-~zod=0v-cookie',
      'posts',
      'react',
      '--help',
    ],
    'Usage: tlon posts react'
  ),
  helpCase(
    'posts send --help',
    ['posts', 'send', '--help'],
    'Usage: tlon posts send'
  ),
  helpCase(
    'posts reply --help',
    ['posts', 'reply', '--help'],
    'Usage: tlon posts reply'
  ),
  helpCase(
    'posts unreact --help',
    ['posts', 'unreact', '--help'],
    'Usage: tlon posts unreact'
  ),
  helpCase(
    'posts delete --help',
    ['posts', 'delete', '--help'],
    'Usage: tlon posts delete'
  ),
  helpCase(
    'posts edit --help',
    ['posts', 'edit', '--help'],
    'Usage: tlon posts edit'
  ),
  helpCase(
    'notes status --help',
    ['notes', 'status', '--help'],
    'Usage: tlon notes status'
  ),
  helpCase(
    'notes list --help',
    ['notes', 'list', '--help'],
    'Usage: tlon notes list'
  ),
  helpCase(
    'notes show --help',
    ['notes', 'show', '--help'],
    'Usage: tlon notes show'
  ),
  helpCase(
    'notes notes --help',
    ['notes', 'notes', '--help'],
    'Usage: tlon notes notes'
  ),
  helpCase(
    'notes note --help',
    ['notes', 'note', '--help'],
    'Usage: tlon notes note'
  ),
  helpCase(
    'notes create --help',
    ['notes', 'create', '--help'],
    'Usage: tlon notes create'
  ),
  helpCase(
    'notes note-create --help',
    ['notes', 'note-create', '--help'],
    'Usage: tlon notes note-create'
  ),
  helpCase(
    'notes note-update --help',
    ['notes', 'note-update', '--help'],
    'Usage: tlon notes note-update'
  ),
  helpCase(
    'notes note-rename --help',
    ['notes', 'note-rename', '--help'],
    'Usage: tlon notes note-rename'
  ),
  helpCase(
    'notes note-move --help',
    ['notes', 'note-move', '--help'],
    'Usage: tlon notes note-move'
  ),
  helpCase(
    'notes note-delete --help',
    ['notes', 'note-delete', '--help'],
    'Usage: tlon notes note-delete'
  ),
  helpCase(
    'notes history --help',
    ['notes', 'history', '--help'],
    'Usage: tlon notes history'
  ),
  helpCase(
    'notes folders --help',
    ['notes', 'folders', '--help'],
    'Usage: tlon notes folders'
  ),
  helpCase(
    'notes folder --help',
    ['notes', 'folder', '--help'],
    'Usage: tlon notes folder'
  ),
  helpCase(
    'notes folder-create --help',
    ['notes', 'folder-create', '--help'],
    'Usage: tlon notes folder-create'
  ),
  helpCase(
    'notes folder-rename --help',
    ['notes', 'folder-rename', '--help'],
    'Usage: tlon notes folder-rename'
  ),
  helpCase(
    'notes folder-move --help',
    ['notes', 'folder-move', '--help'],
    'Usage: tlon notes folder-move'
  ),
  helpCase(
    'notes folder-delete --help',
    ['notes', 'folder-delete', '--help'],
    'Usage: tlon notes folder-delete'
  ),
  helpCase(
    'notes members --help',
    ['notes', 'members', '--help'],
    'Usage: tlon notes members'
  ),
  helpCase(
    'notes join --help',
    ['notes', 'join', '--help'],
    'Usage: tlon notes join'
  ),
  helpCase(
    'notes leave --help',
    ['notes', 'leave', '--help'],
    'Usage: tlon notes leave'
  ),
];

export const LITERAL_OPTION_LIKE_VALUE_CASES: CliCase[] = [
  authRequiredCase('posts react valid args reaches auth', [
    'posts',
    'react',
    'chat/~host/channel',
    '170.141',
    '👍',
  ]),
  authRequiredCase('dms send message option-like value reaches auth', [
    'dms',
    'send',
    '0v123',
    'use',
    '--help',
  ]),
  authRequiredCase('dms reply message option-like value reaches auth', [
    'dms',
    'reply',
    '0v123',
    '~zod/170.141',
    'use',
    '--help',
  ]),
  authRequiredCase('posts edit message option-like value reaches auth', [
    'posts',
    'edit',
    'chat/~host/channel',
    '170.141',
    'use',
    '--help',
  ]),
  authRequiredCase('posts send message option-like value reaches auth', [
    'posts',
    'send',
    'chat/~host/channel',
    'use',
    '--help',
  ]),
  authRequiredCase('posts send with valid blob reaches auth', [
    'posts',
    'send',
    'chat/~host/channel',
    'message',
    '--blob',
    '[{"type":"a2ui","version":1,"messages":[]}]',
  ]),
  authRequiredCase('posts send image-only reaches auth', [
    'posts',
    'send',
    'chat/~host/channel',
    '--image',
    'https://example.com/x.png',
  ]),
  authRequiredCase('dms send image-only reaches auth', [
    'dms',
    'send',
    '0v5.abcde',
    '--image',
    'https://example.com/x.png',
  ]),
  authRequiredCase('posts reply message option-like value reaches auth', [
    'posts',
    'reply',
    'chat/~host/channel',
    '170.141',
    'use',
    '--help',
  ]),
  authRequiredCase('messages search query option-like value reaches auth', [
    'messages',
    'search',
    '--channel',
    '--channel',
    'chat/~host/channel',
  ]),
  authRequiredCase(
    'contacts update-profile value option-like value reaches auth',
    ['contacts', 'update-profile', '--status', '--help']
  ),
  authRequiredCase('contacts update value option-like value reaches auth', [
    'contacts',
    'update',
    '~zod',
    '--nickname',
    '-h',
  ]),
  authRequiredCase('channels create title option-like value reaches auth', [
    'channels',
    'create',
    '~host/group',
    '--roadmap',
  ]),
  authRequiredCase('channels create exact flag-name title reaches auth', [
    'channels',
    'create',
    '~host/group',
    '--kind',
  ]),
  authRequiredCase('channels rename title option-like value reaches auth', [
    'channels',
    'rename',
    'chat/~host/channel',
    '--roadmap',
  ]),
  authRequiredCase('channels update title option-like value reaches auth', [
    'channels',
    'update',
    'chat/~host/channel',
    '--title',
    '--help',
  ]),
  authRequiredCase('groups create title option-like value reaches auth', [
    'groups',
    'create',
    '--roadmap',
  ]),
  authRequiredCase('groups create exact flag-name title reaches auth', [
    'groups',
    'create',
    '--description',
  ]),
  authRequiredCase('groups create exact global-flag-name title reaches auth', [
    'groups',
    'create',
    '--ship',
  ]),
  authRequiredCase('groups create-owned title option-like value reaches auth', [
    'groups',
    'create-owned',
    '--roadmap',
    '--owner',
    '~zod',
  ]),
  authRequiredCase('groups create-owned exact flag-name title reaches auth', [
    'groups',
    'create-owned',
    '--owner',
    '--owner',
    '~zod',
  ]),
  authRequiredCase('groups update title option-like value reaches auth', [
    'groups',
    'update',
    '~host/group',
    '--title',
    '--help',
  ]),
  authRequiredCase('groups add-channel title option-like value reaches auth', [
    'groups',
    'add-channel',
    '~host/group',
    '--announcements',
  ]),
  authRequiredCase('groups add-channel exact flag-name title reaches auth', [
    'groups',
    'add-channel',
    '~host/group',
    '--kind',
  ]),
  authRequiredCase('hooks edit name option-like value reaches auth', [
    'hooks',
    'edit',
    '0v1a',
    '--name',
    '--help',
  ]),
  authRequiredCase('contacts update-profile empty value reaches auth', [
    'contacts',
    'update-profile',
    '--status',
    '',
  ]),
  authRequiredCase('contacts update empty value reaches auth', [
    'contacts',
    'update',
    '~zod',
    '--nickname',
    '',
  ]),
  authRequiredCase('channels update empty value reaches auth', [
    'channels',
    'update',
    'chat/~host/channel',
    '--description',
    '',
  ]),
  authRequiredCase('groups update empty value reaches auth', [
    'groups',
    'update',
    '~host/group',
    '--description',
    '',
  ]),
];

// Posts family completion (send/reply/unreact/delete/edit + family shell).
// Additional react/send/reply cases live in MISSING_REQUIRED_CASES,
// NESTED_HELP_CASES, and LITERAL_OPTION_LIKE_VALUE_CASES.
export const POSTS_FAMILY_CASES: CliCase[] = [
  usageErrorCase(
    'posts unreact missing args',
    ['posts', 'unreact'],
    'Usage: tlon posts unreact'
  ),
  usageErrorCase(
    'posts delete missing args',
    ['posts', 'delete'],
    'Usage: tlon posts delete'
  ),
  authRequiredCase('posts unreact valid args reaches auth', [
    'posts',
    'unreact',
    'chat/~host/channel',
    '170.141',
  ]),
  authRequiredCase('posts delete valid args reaches auth', [
    'posts',
    'delete',
    'chat/~host/channel',
    '170.141',
  ]),
  authRequiredCase('posts edit valid args reaches auth', [
    'posts',
    'edit',
    'chat/~host/channel',
    '170.141',
    'Updated message',
  ]),
  // The minimal help-literal: `--help` in the message slot is treated as edit
  // message content, so this reaches auth instead of printing help.
  authRequiredCase('posts edit minimal help-literal reaches auth', [
    'posts',
    'edit',
    'chat/~host/channel',
    '170.141',
    '--help',
  ]),
  // The notebook-only edit flags are removed: `--content`/`--title`/`--image`
  // on `posts edit` refuse locally, before any auth/filesystem work.
  refusalCase(
    'posts edit --content refuses before auth',
    [
      'posts',
      'edit',
      'chat/~host/channel',
      '170.141',
      '--content',
      '/nonexistent/story.json',
    ],
    'no longer supports --title/--image/--content'
  ),
  refusalCase(
    'posts edit --title refuses even with a help token',
    ['posts', 'edit', 'chat/~host/channel', '170.141', '--title', '--help'],
    'no longer supports --title/--image/--content'
  ),
  // send/reply help-literal quirk: a help token in the message slot is treated
  // as literal message content, so these reach auth instead of printing help.
  authRequiredCase('posts send minimal help-literal reaches auth', [
    'posts',
    'send',
    'chat/~host/channel',
    '--help',
  ]),
  authRequiredCase('posts reply minimal help-literal reaches auth', [
    'posts',
    'reply',
    'chat/~host/channel',
    '170.141',
    '--help',
  ]),
];

// The `notes` family: required-arg matrices (no credential lookup) and
// valid-looking invocations that reach auth with `Missing Urbit config`.
export const NOTES_FAMILY_CASES: CliCase[] = [
  usageErrorCase(
    'notes show missing nest',
    ['notes', 'show'],
    'Usage: tlon notes show'
  ),
  usageErrorCase(
    'notes note missing id',
    ['notes', 'note', 'notes/~zod/blog'],
    'Usage: tlon notes note'
  ),
  usageErrorCase(
    'notes note rejects non-numeric id',
    ['notes', 'note', 'notes/~zod/blog', 'abc'],
    'Invalid note id: abc'
  ),
  usageErrorCase(
    'notes create missing title',
    ['notes', 'create'],
    'Usage: tlon notes create'
  ),
  usageErrorCase(
    'notes note-create missing content source',
    ['notes', 'note-create', 'notes/~zod/blog', 'root', 'Title'],
    'A content source is required'
  ),
  usageErrorCase(
    'notes note-create rejects two content sources',
    [
      'notes',
      'note-create',
      'notes/~zod/blog',
      'root',
      'Title',
      '--stdin',
      '--body',
      'a.md',
    ],
    'Only one content source may be provided'
  ),
  usageErrorCase(
    'notes note-create rejects bad folder',
    ['notes', 'note-create', 'notes/~zod/blog', 'nope', 'Title', '--stdin'],
    'Invalid folder: nope'
  ),
  usageErrorCase(
    'notes note-update missing content source',
    ['notes', 'note-update', 'notes/~zod/blog', '12'],
    'A content source is required'
  ),
  usageErrorCase(
    'notes note-update rejects non-numeric expected-revision',
    [
      'notes',
      'note-update',
      'notes/~zod/blog',
      '12',
      '--stdin',
      '--expected-revision',
      'x',
    ],
    '--expected-revision requires a numeric value'
  ),
  authRequiredCase('notes list reaches auth', ['notes', 'list']),
  authRequiredCase('notes status reaches auth', ['notes', 'status']),
  authRequiredCase('notes show reaches auth', [
    'notes',
    'show',
    'notes/~zod/blog',
  ]),
  authRequiredCase('notes note reaches auth', [
    'notes',
    'note',
    'notes/~zod/blog',
    '12',
  ]),
  authRequiredCase('notes create reaches auth', ['notes', 'create', 'Title']),
  authRequiredCase('notes note-create reaches auth', [
    'notes',
    'note-create',
    'notes/~zod/blog',
    'root',
    'Title',
    '--stdin',
  ]),
  authRequiredCase('notes note-update reaches auth', [
    'notes',
    'note-update',
    'notes/~zod/blog',
    '12',
    '--stdin',
  ]),
  authRequiredCase('notes join reaches auth', [
    'notes',
    'join',
    'notes/~zod/blog',
  ]),
  authRequiredCase('notes leave reaches auth', [
    'notes',
    'leave',
    'notes/~zod/blog',
  ]),
  // Phase C — folders and remaining note ops.
  usageErrorCase(
    'notes folder missing id',
    ['notes', 'folder', 'notes/~zod/blog'],
    'Usage: tlon notes folder'
  ),
  usageErrorCase(
    'notes folder rejects non-numeric id',
    ['notes', 'folder', 'notes/~zod/blog', 'abc'],
    'Invalid folder id: abc'
  ),
  usageErrorCase(
    'notes folder-create missing name',
    ['notes', 'folder-create', 'notes/~zod/blog'],
    'Usage: tlon notes folder-create'
  ),
  usageErrorCase(
    'notes folder-create rejects non-numeric parent',
    ['notes', 'folder-create', 'notes/~zod/blog', 'Drafts', '--parent', 'x'],
    '--parent requires a numeric value'
  ),
  usageErrorCase(
    'notes folder-rename missing name',
    ['notes', 'folder-rename', 'notes/~zod/blog', '4'],
    'Usage: tlon notes folder-rename'
  ),
  usageErrorCase(
    'notes folder-move missing parent',
    ['notes', 'folder-move', 'notes/~zod/blog', '4'],
    'Usage: tlon notes folder-move'
  ),
  usageErrorCase(
    'notes note-rename missing title',
    ['notes', 'note-rename', 'notes/~zod/blog', '12'],
    'Usage: tlon notes note-rename'
  ),
  usageErrorCase(
    'notes note-move rejects non-numeric folder',
    ['notes', 'note-move', 'notes/~zod/blog', '12', 'abc'],
    'Invalid folder id: abc'
  ),
  authRequiredCase('notes folders reaches auth', [
    'notes',
    'folders',
    'notes/~zod/blog',
  ]),
  authRequiredCase('notes folder reaches auth', [
    'notes',
    'folder',
    'notes/~zod/blog',
    '3',
  ]),
  authRequiredCase('notes folder-create reaches auth', [
    'notes',
    'folder-create',
    'notes/~zod/blog',
    'Drafts',
  ]),
  authRequiredCase('notes folder-rename reaches auth', [
    'notes',
    'folder-rename',
    'notes/~zod/blog',
    '4',
    'Archive',
  ]),
  authRequiredCase('notes folder-move reaches auth', [
    'notes',
    'folder-move',
    'notes/~zod/blog',
    '4',
    '3',
  ]),
  authRequiredCase('notes folder-delete reaches auth', [
    'notes',
    'folder-delete',
    'notes/~zod/blog',
    '4',
  ]),
  authRequiredCase('notes note-rename reaches auth', [
    'notes',
    'note-rename',
    'notes/~zod/blog',
    '12',
    'New Title',
  ]),
  authRequiredCase('notes note-move reaches auth', [
    'notes',
    'note-move',
    'notes/~zod/blog',
    '12',
    '3',
  ]),
  authRequiredCase('notes note-delete reaches auth', [
    'notes',
    'note-delete',
    'notes/~zod/blog',
    '12',
  ]),
  authRequiredCase('notes history reaches auth', [
    'notes',
    'history',
    'notes/~zod/blog',
    '12',
  ]),
  authRequiredCase('notes members reaches auth', [
    'notes',
    'members',
    'notes/~zod/blog',
  ]),
];

// Every removed diary/notebook entry point refuses locally with DIARY_REMOVED,
// before any credential lookup: the `tlon notebook` command (incl. --help),
// `--kind diary` and positional `diary` on channels/groups create, a `diary/...`
// nest on posts/messages/channels, and both expose cite-path forms.
export const DIARY_REMOVED_CASES: CliCase[] = [
  diaryRefusedCase('notebook command refuses', ['notebook']),
  diaryRefusedCase('notebook --help refuses', ['notebook', '--help']),
  diaryRefusedCase('notebook with post args refuses', [
    'notebook',
    'diary/~host/slug',
    'Title',
  ]),
  diaryRefusedCase('channels create --kind diary refuses', [
    'channels',
    'create',
    '~host/group',
    'Notes',
    '--kind',
    'diary',
  ]),
  diaryRefusedCase('channels create positional diary refuses', [
    'channels',
    'create',
    '~host/group',
    'diary',
    'Notes',
  ]),
  diaryRefusedCase('channels create --kind=diary equals form refuses', [
    'channels',
    'create',
    '~host/group',
    'Notes',
    '--kind=diary',
  ]),
  diaryRefusedCase('groups add-channel --kind diary refuses', [
    'groups',
    'add-channel',
    '~host/group',
    'Notes',
    '--kind',
    'diary',
  ]),
  diaryRefusedCase('groups add-channel positional diary refuses', [
    'groups',
    'add-channel',
    '~host/group',
    'diary',
    'Notes',
  ]),
  diaryRefusedCase('posts react diary nest refuses', [
    'posts',
    'react',
    'diary/~host/blog',
    '170.141',
    '👍',
  ]),
  diaryRefusedCase('posts edit diary nest refuses', [
    'posts',
    'edit',
    'diary/~host/blog',
    '170.141',
    'Updated',
  ]),
  diaryRefusedCase('messages channel diary nest refuses', [
    'messages',
    'channel',
    'diary/~host/blog',
  ]),
  diaryRefusedCase('channels info diary nest refuses', [
    'channels',
    'info',
    'diary/~host/blog',
  ]),
  diaryRefusedCase('expose show simplified diary path refuses', [
    'expose',
    'show',
    'diary/~host/blog/170.141',
  ]),
  diaryRefusedCase('expose check full diary cite path refuses', [
    'expose',
    'check',
    '/1/chan/diary/~host/blog/note/170.141',
  ]),
  diaryRefusedCase('expose url simplified diary path refuses', [
    'expose',
    'url',
    'diary/~host/blog/170.141',
  ]),
  diaryRefusedCase('expose hide full diary cite path refuses', [
    'expose',
    'hide',
    '/1/chan/diary/~host/blog/note/170.141',
  ]),
];

// Phase D — `%notes` as a channel kind on `channels create` / `groups
// add-channel`. The real create/registration is live-only; hermetically we can
// prove `--kind notes` is a valid kind that reaches auth, that `--description`
// is refused, and that writer roles are refused on a notes nest.
export const NOTES_CHANNEL_KIND_CASES: CliCase[] = [
  authRequiredCase('channels create --kind notes reaches auth', [
    'channels',
    'create',
    '~host/group',
    'Notes',
    '--kind',
    'notes',
  ]),
  authRequiredCase('groups add-channel --kind notes reaches auth', [
    'groups',
    'add-channel',
    '~host/group',
    'Notes',
    '--kind',
    'notes',
  ]),
  usageErrorCase(
    'channels create --kind notes rejects --description',
    [
      'channels',
      'create',
      '~host/group',
      'Notes',
      '--kind',
      'notes',
      '--description',
      'x',
    ],
    '--description is not supported for --kind notes'
  ),
  usageErrorCase(
    'groups add-channel --kind notes rejects --description',
    [
      'groups',
      'add-channel',
      '~host/group',
      'Notes',
      '--kind',
      'notes',
      '--description',
      'x',
    ],
    '--description is not supported for --kind notes'
  ),
  usageErrorCase(
    'channels create rejects positional notes kind',
    ['channels', 'create', '~host/group', 'notes', 'Title'],
    'channel kind must be passed with --kind'
  ),
  // An option-like title literal in the title slot is NOT a --description option;
  // --kind notes should still reach auth rather than be wrongly refused.
  authRequiredCase(
    'channels create --kind notes with option-like title reaches auth',
    [
      'channels',
      'create',
      '~host/group',
      '--description=Title',
      '--kind',
      'notes',
    ]
  ),
  refusalCase(
    'channels add-writers on a notes nest refuses',
    ['channels', 'add-writers', 'notes/~host/blog', 'admin'],
    'Writer roles are not supported for %notes channels'
  ),
  refusalCase(
    'channels del-writers on a notes nest refuses',
    ['channels', 'del-writers', 'notes/~host/blog', 'admin'],
    'Writer roles are not supported for %notes channels'
  ),
];

export const CLI_MATRIX_CASES: CliCase[] = [
  TOP_LEVEL_HELP_CASE,
  UNKNOWN_TOP_LEVEL_CASE,
  ...FAMILY_HELP_CASES,
  ...FAMILY_BARE_CASES,
  ...INVALID_SUBCOMMAND_CASES,
  ...MISSING_REQUIRED_CASES,
  ...SPECIAL_INPUT_CASES,
  ...NESTED_HELP_CASES,
  ...LITERAL_OPTION_LIKE_VALUE_CASES,
  ...POSTS_FAMILY_CASES,
  ...NOTES_FAMILY_CASES,
  ...NOTES_CHANNEL_KIND_CASES,
  ...DIARY_REMOVED_CASES,
];

export type HostileHelpCommand = {
  name: string;
  args: string[];
};

// Help paths that must perform no credential lookup even under hostile config:
// the top-level help, every command family's `<family> --help`, and the
// migrated nested `posts <subcommand> --help` paths.
export const HOSTILE_HELP_COMMANDS: HostileHelpCommand[] = [
  { name: 'top-level', args: ['--help'] },
  ...COMMAND_FAMILIES.map((family) => ({
    name: family,
    args: [family, '--help'],
  })),
  { name: 'posts react', args: ['posts', 'react', '--help'] },
  { name: 'posts send', args: ['posts', 'send', '--help'] },
  { name: 'posts reply', args: ['posts', 'reply', '--help'] },
  { name: 'posts unreact', args: ['posts', 'unreact', '--help'] },
  { name: 'posts delete', args: ['posts', 'delete', '--help'] },
  { name: 'posts edit', args: ['posts', 'edit', '--help'] },
  { name: 'notes status', args: ['notes', 'status', '--help'] },
  { name: 'notes list', args: ['notes', 'list', '--help'] },
  { name: 'notes show', args: ['notes', 'show', '--help'] },
  { name: 'notes notes', args: ['notes', 'notes', '--help'] },
  { name: 'notes note', args: ['notes', 'note', '--help'] },
  { name: 'notes create', args: ['notes', 'create', '--help'] },
  { name: 'notes note-create', args: ['notes', 'note-create', '--help'] },
  { name: 'notes note-update', args: ['notes', 'note-update', '--help'] },
  { name: 'notes note-rename', args: ['notes', 'note-rename', '--help'] },
  { name: 'notes note-move', args: ['notes', 'note-move', '--help'] },
  { name: 'notes note-delete', args: ['notes', 'note-delete', '--help'] },
  { name: 'notes history', args: ['notes', 'history', '--help'] },
  { name: 'notes folders', args: ['notes', 'folders', '--help'] },
  { name: 'notes folder', args: ['notes', 'folder', '--help'] },
  { name: 'notes folder-create', args: ['notes', 'folder-create', '--help'] },
  { name: 'notes folder-rename', args: ['notes', 'folder-rename', '--help'] },
  { name: 'notes folder-move', args: ['notes', 'folder-move', '--help'] },
  { name: 'notes folder-delete', args: ['notes', 'folder-delete', '--help'] },
  { name: 'notes members', args: ['notes', 'members', '--help'] },
  { name: 'notes join', args: ['notes', 'join', '--help'] },
  { name: 'notes leave', args: ['notes', 'leave', '--help'] },
];

export function normalizeCliOutput(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
