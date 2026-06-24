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
];

export function normalizeCliOutput(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
