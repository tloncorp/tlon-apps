export const COMMAND_FAMILIES = [
  'activity',
  'channels',
  'contacts',
  'dms',
  'expose',
  'groups',
  'hooks',
  'messages',
  'notebook',
  'posts',
  'settings',
  'upload',
] as const;

export const SUBCOMMAND_FAMILIES = COMMAND_FAMILIES.filter(
  (family) => family !== 'notebook' && family !== 'upload'
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
  'Usage: notebook-post.ts',
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
  'Example: notebook-post.ts',
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
  'scripts/notebook-post.ts',
  'scripts/posts.ts',
  'scripts/settings.ts',
];

const STACK_PATTERNS = [
  '\n    at ',
  '\n  at ',
  'api-client.ts:',
  'notebook-post.ts:',
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
  usageErrorCase('notebook missing args', ['notebook'], 'Usage: tlon notebook'),
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
  {
    name: 'notebook unknown option',
    args: [
      'notebook',
      'diary/~host/notes',
      'Title',
      '--definitely-not-an-option',
    ],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Error: Unknown option: --definitely-not-an-option'],
    stderrExcludes: [
      ...SCRIPT_ERA_PATTERNS,
      ...STACK_PATTERNS,
      ...AUTH_CONFIG_PATTERNS,
    ],
  },
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
];

export const LITERAL_OPTION_LIKE_VALUE_CASES: CliCase[] = [
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
  authRequiredCase('notebook title option-like value reaches auth', [
    'notebook',
    'diary/~host/notes',
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
];

export function normalizeCliOutput(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
