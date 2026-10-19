import {
  DIARY_REMOVED,
  NOTES_CHANNEL_CONTENT_UNSUPPORTED,
  nonGroupChannelNestMessage,
  notesChannelMembershipMessage,
} from './cli-utils';

export const COMMAND_FAMILIES = [
  'activity',
  'browser',
  'buckets',
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
  'Usage: browser.ts',
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
  'Example: browser.ts',
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
  'scripts/browser.ts',
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

function notesContentRefusedCase(name: string, args: string[]): CliCase {
  return refusalCase(name, args, NOTES_CHANNEL_CONTENT_UNSUPPORTED);
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
    'groups invite-link missing flag',
    ['groups', 'invite-link'],
    'Usage: tlon groups invite-link'
  ),
  usageErrorCase(
    'groups invite-link rejects malformed flag',
    ['groups', 'invite-link', 'not-a-flag'],
    'Usage: tlon groups invite-link'
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
  usageErrorCase(
    'posts send missing gallery title value',
    ['posts', 'send', 'heap/~host/gallery', 'message', '--title'],
    'Usage: tlon posts send'
  ),
  usageErrorCase(
    'posts send rejects an option token as a gallery title value',
    [
      'posts',
      'send',
      'heap/~zod/gallery',
      'caption',
      '--title',
      '--sent-at',
      '1234',
    ],
    'Usage: tlon posts send'
  ),
  {
    name: 'posts send rejects an invalid image url',
    args: ['posts', 'send', 'chat/~host/channel', '--image', 'ftp://x/y.png'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Invalid media URL — pass a public https URL'],
  },
  {
    name: 'posts send rejects an invalid equals image url',
    args: ['posts', 'send', 'chat/~host/channel', '--image=ftp://x/y.png'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Invalid media URL — pass a public https URL'],
  },
  {
    name: 'posts send rejects a plain-http image url',
    args: ['posts', 'send', 'chat/~host/channel', '--image', 'http://x/y.png'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Only https media URLs are supported.'],
  },
  {
    name: 'posts send rejects a local image path',
    args: [
      'posts',
      'send',
      'chat/~host/channel',
      '--image',
      '/pier/generated.png',
    ],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Local file paths are not supported for --image'],
  },
  {
    name: 'posts send rejects an image url with embedded credentials',
    args: [
      'posts',
      'send',
      'chat/~host/channel',
      '--image',
      'https://u:p@x/y.png',
    ],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Media URLs with embedded credentials are not supported.'],
  },
  usageErrorCase(
    'posts send rejects a value on the valueless --bot flag',
    ['posts', 'send', 'chat/~host/channel', 'message', '--bot=Botly'],
    'Usage: tlon posts send'
  ),
  usageErrorCase(
    'dms send missing image value',
    ['dms', 'send', '0v5.abcde', '--image'],
    'Usage: tlon dms send'
  ),
  usageErrorCase(
    'dms reply rejects a value on the valueless --bot flag',
    ['dms', 'reply', '0v5.abcde', '~pen/170.141', 'message', '--bot=Botly'],
    'Usage: tlon dms reply'
  ),
  {
    name: 'dms send rejects an invalid equals image url',
    args: ['dms', 'send', '0v5.abcde', '--image=ftp://x/y.png'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Invalid media URL — pass a public https URL'],
  },
  {
    name: 'dms send rejects a plain-http image url',
    args: ['dms', 'send', '0v5.abcde', '--image', 'http://x/y.png'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Only https media URLs are supported.'],
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
  ...(['mute', 'unmute', 'volume'] as const).map((command) =>
    helpCase(
      `activity ${command} --help`,
      ['activity', command, '--help'],
      `Usage: tlon activity ${command}`
    )
  ),
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
    'groups invite-link --help',
    ['groups', 'invite-link', '--help'],
    'Usage: tlon groups invite-link'
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
    'notes request --help',
    ['notes', 'request', '--help'],
    'Usage: tlon notes request'
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
    'notes note-publish --help',
    ['notes', 'note-publish', '--help'],
    'Usage: tlon notes note-publish'
  ),
  helpCase(
    'notes note-unpublish --help',
    ['notes', 'note-unpublish', '--help'],
    'Usage: tlon notes note-unpublish'
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
  authRequiredCase('posts send heap title reaches auth', [
    'posts',
    'send',
    'heap/~host/gallery',
    'message',
    '--title',
    'Gallery item',
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
  authRequiredCase('groups create-owned with --admin reaches auth', [
    'groups',
    'create-owned',
    'Projects',
    '--admin',
    '~pinser-botter-sampel-palnet',
  ]),
  authRequiredCase('groups create-owned --self reaches auth', [
    'groups',
    'create-owned',
    'Projects',
    '--admin',
    '~sampel-palnet',
    '--self',
  ]),
  authRequiredCase(
    'groups create-owned --admin as a description reaches auth',
    [
      'groups',
      'create-owned',
      'Projects',
      '--description',
      '--admin',
      '--owner',
      '~sampel-palnet',
    ]
  ),
  authRequiredCase(
    'groups create-owned legacy --owner after a description reaches auth',
    [
      'groups',
      'create-owned',
      'Projects',
      '--description',
      '--owner',
      '~sampel-palnet',
    ]
  ),
  usageErrorCase(
    'groups create-owned rejects a missing admin',
    ['groups', 'create-owned', 'Projects', '--description', 'Shared'],
    'Usage: tlon groups create-owned'
  ),
  usageErrorCase(
    'groups create-owned rejects a bare --admin',
    ['groups', 'create-owned', 'Projects', '--admin'],
    'Usage: tlon groups create-owned'
  ),
  usageErrorCase(
    'groups create-owned rejects a flag as the admin',
    ['groups', 'create-owned', 'Projects', '--admin', '--description'],
    'Usage: tlon groups create-owned'
  ),
  authRequiredCase('channels create --self reaches auth', [
    'channels',
    'create',
    '~sampel-palnet/team',
    'Discussion',
    '--self',
  ]),
  authRequiredCase('groups add-channel --self reaches auth', [
    'groups',
    'add-channel',
    '~sampel-palnet/team',
    'Discussion',
    '--self',
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
  {
    ...usageErrorCase(
      'posts send title on chat nest refuses before auth',
      [
        'posts',
        'send',
        'chat/~host/channel',
        'message',
        '--title',
        'Chat title',
      ],
      '--title is only supported for gallery (heap/) posts'
    ),
    stderrIncludes: [
      '--title is only supported for gallery (heap/) posts',
      'Usage: tlon posts send',
    ],
  },
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

// `posts pin`/`unpin` and thread-reply `edit`/`delete --parent`: target and
// argument refusals are local; well-formed invocations reach auth.
export const POSTS_PIN_AND_REPLY_CASES: CliCase[] = [
  helpCase('posts pin --help', ['posts', 'pin', '--help'], 'tlon posts pin'),
  helpCase(
    'posts unpin --help',
    ['posts', 'unpin', '--help'],
    'tlon posts unpin'
  ),
  usageErrorCase(
    'posts pin missing post id',
    ['posts', 'pin', 'chat/~host/channel'],
    'Usage: tlon posts pin'
  ),
  usageErrorCase(
    'posts unpin missing args',
    ['posts', 'unpin'],
    'Usage: tlon posts unpin'
  ),
  {
    ...usageErrorCase(
      'posts pin rejects an extra token',
      ['posts', 'pin', 'chat/~host/channel', '170.141', '--parent', '170.140'],
      'Unexpected argument: --parent'
    ),
    stderrIncludes: ['Unexpected argument: --parent', 'Usage: tlon posts pin'],
  },
  {
    ...usageErrorCase(
      'posts unpin rejects an extra token',
      ['posts', 'unpin', 'chat/~host/channel', '170.141', 'extra'],
      'Unexpected argument: extra'
    ),
    stderrIncludes: ['Unexpected argument: extra', 'Usage: tlon posts unpin'],
  },
  usageErrorCase(
    'posts edit rejects an option-like --parent value',
    [
      'posts',
      'edit',
      'chat/~host/channel',
      '170.142',
      'text',
      '--parent',
      '--x',
    ],
    'Usage: tlon posts edit'
  ),
  usageErrorCase(
    'posts edit rejects text that was only --parent',
    ['posts', 'edit', 'chat/~host/channel', '170.142', '--parent', '170.141'],
    'Usage: tlon posts edit'
  ),
  usageErrorCase(
    'posts delete rejects --parent in the post id slot',
    ['posts', 'delete', 'chat/~host/channel', '--parent', '170.141'],
    'Usage: tlon posts delete'
  ),
  authRequiredCase('posts pin valid args reaches auth', [
    'posts',
    'pin',
    'chat/~host/channel',
    '170.141',
  ]),
  authRequiredCase('posts pin with a host lacking ~ reaches auth', [
    'posts',
    'pin',
    'chat/host/channel',
    '170.141',
  ]),
  authRequiredCase('posts unpin valid args reaches auth', [
    'posts',
    'unpin',
    'heap/~host/gallery',
    '170.141',
  ]),
  authRequiredCase('posts edit --parent reaches auth', [
    'posts',
    'edit',
    'chat/~host/channel',
    '170.142',
    'Fixed text',
    '--parent',
    '170.141',
  ]),
  authRequiredCase('posts delete --parent reaches auth', [
    'posts',
    'delete',
    'chat/~host/channel',
    '170.142',
    '--parent',
    '170.141',
  ]),
  refusalCase(
    'posts pin refuses a DM target before auth',
    ['posts', 'pin', '~zod', '170.141'],
    'Pins are for group channels (chat/ or heap/); ~zod is a DM.'
  ),
  refusalCase(
    'posts unpin refuses a non-group nest before auth',
    ['posts', 'unpin', 'buckets/~host/files', '170.141'],
    'Pins are for group chat/ and heap/ channels; buckets/~host/files is not one.'
  ),
  refusalCase(
    'posts delete --parent refuses a DM target before auth',
    ['posts', 'delete', '0v1.abc', '170.142', '--parent', '170.141'],
    'Editing or deleting a thread reply is supported in group channels only; 0v1.abc is a DM.'
  ),
  diaryRefusedCase('posts pin diary nest refuses', [
    'posts',
    'pin',
    'diary/~host/blog',
    '170.141',
  ]),
  diaryRefusedCase('posts unpin diary nest refuses', [
    'posts',
    'unpin',
    'diary/~host/blog',
    '170.141',
  ]),
  notesContentRefusedCase('posts pin notes nest refuses', [
    'posts',
    'pin',
    'notes/~host/blog',
    '170.141',
  ]),
  notesContentRefusedCase('posts unpin notes nest refuses', [
    'posts',
    'unpin',
    'notes/~host/blog',
    '170.141',
  ]),
];

// `--parent` on the four react/unreact commands (posts + dms families):
// malformed values are rejected locally (an option-like value or a
// duplicate flag), and a well-formed value reaches auth — exercising
// main()'s wiring end to end, not just the exported parser helpers.
export const REACTION_PARENT_CASES: CliCase[] = [
  usageErrorCase(
    'posts react rejects option-like --parent value',
    [
      'posts',
      'react',
      'chat/~host/channel',
      '170.141',
      '👍',
      '--parent',
      '--bogus',
    ],
    'Usage: tlon posts react'
  ),
  usageErrorCase(
    'posts react rejects duplicate --parent',
    [
      'posts',
      'react',
      'chat/~host/channel',
      '170.142',
      '👍',
      '--parent',
      '170.141',
      '--parent',
      '170.140',
    ],
    'Usage: tlon posts react'
  ),
  usageErrorCase(
    'posts unreact rejects option-like --parent value',
    [
      'posts',
      'unreact',
      'chat/~host/channel',
      '170.141',
      '--parent',
      '--bogus',
    ],
    'Usage: tlon posts unreact'
  ),
  usageErrorCase(
    'posts unreact rejects duplicate --parent',
    [
      'posts',
      'unreact',
      'chat/~host/channel',
      '170.142',
      '--parent',
      '170.141',
      '--parent',
      '170.140',
    ],
    'Usage: tlon posts unreact'
  ),
  usageErrorCase(
    'dms react rejects option-like --parent value',
    ['dms', 'react', '~zod', '~zod/170.141', '👍', '--parent', '--bogus'],
    'Usage: tlon dms react'
  ),
  usageErrorCase(
    'dms react rejects duplicate --parent',
    [
      'dms',
      'react',
      '~zod',
      '~zod/170.142',
      '👍',
      '--parent',
      '~zod/170.141',
      '--parent',
      '~zod/170.140',
    ],
    'Usage: tlon dms react'
  ),
  usageErrorCase(
    'dms unreact rejects option-like --parent value',
    ['dms', 'unreact', '~zod', '~zod/170.141', '--parent', '--bogus'],
    'Usage: tlon dms unreact'
  ),
  usageErrorCase(
    'dms unreact rejects duplicate --parent',
    [
      'dms',
      'unreact',
      '~zod',
      '~zod/170.142',
      '--parent',
      '~zod/170.141',
      '--parent',
      '~zod/170.140',
    ],
    'Usage: tlon dms unreact'
  ),
  usageErrorCase(
    'posts react rejects --parent swallowed into the omitted emoji slot',
    ['posts', 'react', 'chat/~host/channel', '170.142', '--parent', '170.141'],
    'Usage: tlon posts react'
  ),
  usageErrorCase(
    'dms react rejects --parent swallowed into the omitted emoji slot',
    ['dms', 'react', '~zod', '~zod/170.142', '--parent', '~zod/170.141'],
    'Usage: tlon dms react'
  ),
  authRequiredCase('posts react with --parent reaches auth', [
    'posts',
    'react',
    'chat/~host/channel',
    '170.142',
    '👍',
    '--parent',
    '170.141',
  ]),
  authRequiredCase('posts unreact with --parent reaches auth', [
    'posts',
    'unreact',
    'chat/~host/channel',
    '170.142',
    '--parent',
    '170.141',
  ]),
  authRequiredCase('dms react with --parent reaches auth', [
    'dms',
    'react',
    '~zod',
    '~zod/170.142',
    '👍',
    '--parent',
    '~zod/170.141',
  ]),
  authRequiredCase('dms unreact with --parent reaches auth', [
    'dms',
    'unreact',
    '~zod',
    '~zod/170.142',
    '--parent',
    '~zod/170.141',
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
  usageErrorCase(
    'notes request missing id',
    ['notes', 'request'],
    'Usage: tlon notes request'
  ),
  usageErrorCase(
    'notes request rejects path-like id',
    ['notes', 'request', 'notes/~zod/blog'],
    'Invalid request id'
  ),
  authRequiredCase('notes request reaches auth', ['notes', 'request', '0vabc']),
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
  authRequiredCase('notes create option-like title reaches auth', [
    'notes',
    'create',
    '--draft',
    'Roadmap',
  ]),
  authRequiredCase('notes note-create reaches auth', [
    'notes',
    'note-create',
    'notes/~zod/blog',
    'root',
    'Title',
    '--stdin',
  ]),
  authRequiredCase('notes note-create option-like title reaches auth', [
    'notes',
    'note-create',
    'notes/~zod/blog',
    'root',
    'Roadmap',
    '--draft',
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
  usageErrorCase(
    'notes note-publish missing id',
    ['notes', 'note-publish', 'notes/~zod/blog'],
    'Usage: tlon notes note-publish'
  ),
  usageErrorCase(
    'notes note-unpublish missing id',
    ['notes', 'note-unpublish', 'notes/~zod/blog'],
    'Usage: tlon notes note-unpublish'
  ),
  usageErrorCase(
    'notes note-publish rejects non-numeric id',
    ['notes', 'note-publish', 'notes/~zod/blog', 'abc'],
    'Invalid note id: abc'
  ),
  usageErrorCase(
    'notes note-publish rejects an unknown option',
    ['notes', 'note-publish', 'notes/~zod/blog', '12', '--force'],
    'Unknown option: --force'
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
  authRequiredCase('notes folder-create option-like name reaches auth', [
    'notes',
    'folder-create',
    'notes/~zod/blog',
    'Drafts',
    '--local',
    '--parent',
    '3',
  ]),
  authRequiredCase('notes folder-rename reaches auth', [
    'notes',
    'folder-rename',
    'notes/~zod/blog',
    '4',
    'Archive',
  ]),
  authRequiredCase('notes folder-rename option-like name reaches auth', [
    'notes',
    'folder-rename',
    'notes/~zod/blog',
    '4',
    '--local',
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
  authRequiredCase('notes note-rename option-like title reaches auth', [
    'notes',
    'note-rename',
    'notes/~zod/blog',
    '12',
    '--draft',
    'Title',
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
  authRequiredCase('notes note-publish reaches auth', [
    'notes',
    'note-publish',
    'notes/~zod/blog',
    '12',
  ]),
  authRequiredCase('notes note-publish --self reaches auth', [
    'notes',
    'note-publish',
    'notes/~zod/blog',
    '12',
    '--self',
  ]),
  authRequiredCase('notes note-unpublish reaches auth', [
    'notes',
    'note-unpublish',
    'notes/~zod/blog',
    '12',
  ]),
  authRequiredCase('notes note-unpublish --self reaches auth', [
    'notes',
    'note-unpublish',
    'notes/~zod/blog',
    '12',
    '--self',
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
  authRequiredCase(
    'channels update --description on a notes nest reaches auth',
    ['channels', 'update', 'notes/~host/blog', '--description', 'x']
  ),
  authRequiredCase('channels update --title on a notes nest reaches auth', [
    'channels',
    'update',
    'notes/~host/blog',
    '--title',
    'New Title',
  ]),
  authRequiredCase('channels rename on a notes nest reaches auth', [
    'channels',
    'rename',
    'notes/~host/blog',
    'New Title',
  ]),
];

export const NOTES_CONTENT_UNSUPPORTED_CASES: CliCase[] = [
  notesContentRefusedCase('posts send notes nest refuses', [
    'posts',
    'send',
    'notes/~host/blog',
    'hi',
  ]),
  notesContentRefusedCase('posts reply notes nest refuses', [
    'posts',
    'reply',
    'notes/~host/blog',
    '170.141',
    'hi',
  ]),
  notesContentRefusedCase('posts react notes nest refuses', [
    'posts',
    'react',
    'notes/~host/blog',
    '170.141',
    '👍',
  ]),
  notesContentRefusedCase('posts unreact notes nest refuses', [
    'posts',
    'unreact',
    'notes/~host/blog',
    '170.141',
  ]),
  notesContentRefusedCase('posts delete notes nest refuses', [
    'posts',
    'delete',
    'notes/~host/blog',
    '170.141',
  ]),
  notesContentRefusedCase('posts edit notes nest refuses', [
    'posts',
    'edit',
    'notes/~host/blog',
    '170.141',
    'Updated',
  ]),
  notesContentRefusedCase('messages channel notes nest refuses', [
    'messages',
    'channel',
    'notes/~host/blog',
  ]),
  notesContentRefusedCase('messages history notes nest refuses', [
    'messages',
    'history',
    'notes/~host/blog',
  ]),
  notesContentRefusedCase('messages search notes channel refuses', [
    'messages',
    'search',
    'hello',
    '--channel',
    'notes/~host/blog',
  ]),
  notesContentRefusedCase('messages context notes target refuses', [
    'messages',
    'context',
    'notes/~host/blog',
    '170.141',
  ]),
  notesContentRefusedCase('messages post notes target refuses', [
    'messages',
    'post',
    'notes/~host/blog',
    '170.141',
  ]),
  notesContentRefusedCase('expose show simplified notes path refuses', [
    'expose',
    'show',
    'notes/~host/blog/170.141',
  ]),
  notesContentRefusedCase('expose check full notes cite path refuses', [
    'expose',
    'check',
    '/1/chan/notes/~host/blog/note/170.141',
  ]),
  notesContentRefusedCase('expose url simplified notes path refuses', [
    'expose',
    'url',
    'notes/~host/blog/170.141',
  ]),
  notesContentRefusedCase('expose hide full notes cite path refuses', [
    'expose',
    'hide',
    '/1/chan/notes/~host/blog/note/170.141',
  ]),
];

// Black-box credential-routing cases for `groups invite-link` — deterministic
// and pre-network (the hermetic env carries no credentials at all).
export const INVITE_LINK_CREDENTIAL_CASES: CliCase[] = [
  authRequiredCase('groups invite-link reaches normal resolution', [
    'groups',
    'invite-link',
    '~zod/test',
  ]),
  authRequiredCase('groups invite-link --self reaches normal resolution', [
    'groups',
    'invite-link',
    '~zod/test',
    '--self',
  ]),
  {
    name: 'groups invite-link explicit --config beats owner routing',
    args: ['--config', '/nonexistent', 'groups', 'invite-link', '~zod/test'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Ship config not found'],
    stderrExcludes: ['Usage:', ...STACK_PATTERNS],
  },
];

// `groups join --invite`: input validation happens locally, and every path
// that would reach the invite service authenticates first, so the hermetic
// env (no credentials) proves no request leaves before auth.
export const JOIN_INVITE_CASES: CliCase[] = [
  usageErrorCase(
    'groups join --invite missing value',
    ['groups', 'join', '--invite'],
    'Usage: tlon groups join'
  ),
  usageErrorCase(
    'groups join --invite rejects unknown host',
    ['groups', 'join', '--invite', 'https://example.com/0v1.abcde'],
    'Usage: tlon groups join'
  ),
  usageErrorCase(
    'groups join rejects positional plus --invite',
    ['groups', 'join', '~zod/test', '--invite', '0v1.abcde'],
    'Usage: tlon groups join'
  ),
  refusalCase(
    'groups join --invite DM link refuses',
    ['groups', 'join', '--invite', 'https://invite.tlon.io/dm-~zod'],
    'is a DM link'
  ),
  helpCase(
    'groups join --invite --help',
    ['groups', 'join', '--invite', '0v1.abcde', '--help'],
    'tlon groups join --invite'
  ),
  authRequiredCase('groups join --invite link reaches auth', [
    'groups',
    'join',
    '--invite',
    'https://invite.tlon.io/0v1.abcde',
  ]),
  authRequiredCase('groups join --invite --self reaches auth', [
    'groups',
    'join',
    '--invite',
    'https://invite.tlon.io/0v1.abcde',
    '--self',
  ]),
  authRequiredCase('groups join --invite flag reaches auth', [
    'groups',
    'join',
    '--invite',
    '~zod/test',
  ]),
  {
    name: 'groups join --invite explicit --config is honored',
    args: [
      '--config',
      '/nonexistent',
      'groups',
      'join',
      '--invite',
      'https://invite.tlon.io/0v1.abcde',
    ],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Ship config not found'],
    stderrExcludes: ['Usage:', ...STACK_PATTERNS],
  },
];

// `activity mute|unmute|volume`: target, post-id and level validation and the
// local refusals all happen before any credential lookup.
function activityUsageCase(
  name: string,
  args: string[],
  message: string
): CliCase {
  return {
    ...usageErrorCase(name, ['activity', ...args]),
    stderrIncludes: [`Error: ${message}`, `Usage: tlon activity ${args[0]}`],
  };
}

const DM_LEVELS_MESSAGE =
  'DMs take medium, hush or default (the app offers only these for DMs)';

export const ACTIVITY_VOLUME_CASES: CliCase[] = [
  activityUsageCase(
    'activity volume unknown level',
    ['volume', '~zod/book-club', 'bogus'],
    'Unknown level: bogus. Levels: loud, medium, soft, hush, default'
  ),
  activityUsageCase(
    'activity volume DM soft',
    ['volume', '~ten', 'soft'],
    DM_LEVELS_MESSAGE
  ),
  activityUsageCase(
    'activity mute invalid ship',
    ['mute', '~foo'],
    'Invalid ship: ~foo (expected a ship such as ~sampel-palnet)'
  ),
  activityUsageCase(
    'activity mute invalid group-DM id',
    ['mute', '0v4.abc'],
    'Invalid group-DM id: 0v4.abc (expected a 0v... id such as 0v1f.abcde)'
  ),
  activityUsageCase(
    'activity mute invalid channel',
    ['mute', 'chat//general'],
    'Invalid channel: chat//general (expected chat/~host/channel-slug or heap/~host/channel-slug)'
  ),
  activityUsageCase(
    'activity unmute invalid post id',
    ['unmute', 'chat/~nec/general', '1..2'],
    'Invalid post id: 1..2 (expected a numeric post id such as 170.141.184.507)'
  ),
  activityUsageCase(
    'activity mute group with a post id',
    ['mute', '~zod/book-club', '170.141'],
    'A thread needs a channel (chat/~host/name), not a group id'
  ),
  activityUsageCase(
    'activity mute extra argument',
    ['mute', 'chat/~nec/general', '170.141', 'extra'],
    'Unexpected argument: extra'
  ),
  activityUsageCase(
    'activity mute unknown option',
    ['mute', '~ten', '--force'],
    'Unknown option: --force'
  ),
  refusalCase(
    'activity mute refuses a notes channel',
    ['activity', 'mute', 'notes/~zod/blog'],
    'Notification levels for notes channels are not supported by this command yet'
  ),
  diaryRefusedCase('activity mute refuses a diary channel', [
    'activity',
    'mute',
    'diary/~zod/blog',
  ]),
  refusalCase(
    'activity mute refuses a DM thread',
    ['activity', 'mute', '~ten', '170.141'],
    'Thread notification settings are supported for group channel threads only'
  ),
  authRequiredCase('activity mute reaches auth', ['activity', 'mute', '~ten']),
  authRequiredCase('activity mute --self reaches auth', [
    'activity',
    'mute',
    '~ten',
    '--self',
  ]),
  authRequiredCase('activity volume reaches auth', [
    'activity',
    'volume',
    '~zod/book-club',
    'soft',
  ]),
  authRequiredCase('activity unmute thread reaches auth', [
    'activity',
    'unmute',
    'chat/~nec/general',
    '170.141',
  ]),
  {
    name: 'activity mute explicit --config beats owner routing',
    args: ['--config', '/nonexistent', 'activity', 'mute', '~ten'],
    expectedExitCode: 1,
    stdout: '',
    stderrIncludes: ['Ship config not found'],
    stderrExcludes: ['Usage:', ...STACK_PATTERNS],
  },
];

// `channels leave` / `channels join` pre-auth validation: only chat/heap nests
// reach auth; diary, %notes, and other nests are refused locally.
export const CHANNEL_MEMBERSHIP_CASES: CliCase[] = (
  ['leave', 'join'] as const
).flatMap((verb) => [
  usageErrorCase(
    `channels ${verb} missing nest`,
    ['channels', verb],
    `Usage: tlon channels ${verb}`
  ),
  helpCase(
    `channels ${verb} --help`,
    ['channels', verb, '--help'],
    `Usage: tlon channels ${verb}`
  ),
  diaryRefusedCase(`channels ${verb} diary nest refuses`, [
    'channels',
    verb,
    'diary/~host/blog',
  ]),
  refusalCase(
    `channels ${verb} notes nest points at tlon notes`,
    ['channels', verb, 'notes/~host/blog'],
    notesChannelMembershipMessage('notes/~host/blog', verb)
  ),
  refusalCase(
    `channels ${verb} buckets nest refuses`,
    ['channels', verb, 'buckets/~zod/x'],
    nonGroupChannelNestMessage('buckets/~zod/x', verb)
  ),
  refusalCase(
    `channels ${verb} malformed nest refuses`,
    ['channels', verb, 'chat/~zod'],
    'Invalid nest format: chat/~zod'
  ),
  authRequiredCase(`channels ${verb} chat nest reaches auth`, [
    'channels',
    verb,
    'chat/~zod/x',
  ]),
  authRequiredCase(`channels ${verb} heap nest reaches auth`, [
    'channels',
    verb,
    'heap/~zod/x',
  ]),
]);

const GROUP = '~host/group';
const MOVE_CHANNEL = ['groups', 'move-channel', GROUP, 'chat/~host/general'];

// Section commands validate locally (arity, blank titles, --section/--index,
// nest format) before credentials are looked up.
export const GROUP_SECTION_CASES: CliCase[] = [
  ...(
    [
      ['add-section', ['groups', 'add-section', GROUP]],
      ['rename-section', ['groups', 'rename-section', GROUP, 'Archive']],
      ['delete-section', ['groups', 'delete-section', GROUP]],
      ['move-channel', ['groups', 'move-channel', GROUP]],
      ['order-sections', ['groups', 'order-sections', GROUP]],
    ] as const
  ).flatMap(([command, missingArgs]) => [
    usageErrorCase(
      `groups ${command} missing args`,
      [...missingArgs],
      `Usage: tlon groups ${command}`
    ),
    helpCase(
      `groups ${command} --help`,
      ['groups', command, '--help'],
      `Usage: tlon groups ${command}`
    ),
  ]),
  usageErrorCase(
    'groups add-section blank title',
    ['groups', 'add-section', GROUP, '   '],
    'a non-blank section title is required'
  ),
  usageErrorCase(
    'groups rename-section blank title',
    ['groups', 'rename-section', GROUP, 'Archive', ' '],
    'a non-blank section title is required'
  ),
  usageErrorCase(
    'groups move-channel missing --section',
    [...MOVE_CHANNEL],
    'Usage: tlon groups move-channel'
  ),
  usageErrorCase(
    'groups move-channel --section followed by --index',
    [...MOVE_CHANNEL, '--section', '--index', '2'],
    'Usage: tlon groups move-channel'
  ),
  usageErrorCase(
    'groups move-channel dangling --section',
    [...MOVE_CHANNEL, '--section'],
    'Usage: tlon groups move-channel'
  ),
  ...(
    [
      ['negative', ['--index', '-1']],
      ['non-numeric', ['--index', 'x']],
      ['dangling', ['--index']],
    ] as const
  ).map(([label, index]) =>
    usageErrorCase(
      `groups move-channel ${label} --index`,
      [...MOVE_CHANNEL, '--section', 'Archive', ...index],
      '--index requires a non-negative integer'
    )
  ),
  refusalCase(
    'groups move-channel malformed nest refuses',
    ['groups', 'move-channel', GROUP, 'chat/~host', '--section', 'Archive'],
    'Invalid nest format: chat/~host'
  ),
  diaryRefusedCase('groups move-channel diary nest refuses', [
    'groups',
    'move-channel',
    GROUP,
    'diary/~host/blog',
    '--section',
    'Archive',
  ]),
  authRequiredCase('groups add-section reaches auth', [
    'groups',
    'add-section',
    GROUP,
    'Archive',
  ]),
  authRequiredCase('groups rename-section reaches auth', [
    'groups',
    'rename-section',
    GROUP,
    'Archive',
    'Old stuff',
  ]),
  authRequiredCase('groups delete-section reaches auth', [
    'groups',
    'delete-section',
    GROUP,
    'Archive',
  ]),
  authRequiredCase('groups move-channel reaches auth', [
    ...MOVE_CHANNEL,
    '--section',
    'Archive',
    '--index',
    '0',
  ]),
  authRequiredCase('groups order-sections reaches auth', [
    'groups',
    'order-sections',
    GROUP,
    'Archive',
    'default',
  ]),
];

export const CLI_MATRIX_CASES: CliCase[] = [
  ...(['channels', 'groups'] as const).flatMap((family) => {
    const operation = family === 'channels' ? 'create' : 'add-channel';
    return [[], [operation]].map(
      (suffix): CliCase => ({
        name: `${family} ${suffix.join(' ')} help separates notes creation flags`,
        args: [family, ...suffix, '--help'],
        expectedExitCode: 0,
        stdoutIncludes: [
          '[--kind chat|heap] [--description "..."]',
          '"Channel Name" --kind notes',
        ],
        stdoutExcludes: ['[--kind chat|heap|notes] [--description'],
      })
    );
  }),
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
  ...POSTS_PIN_AND_REPLY_CASES,
  ...REACTION_PARENT_CASES,
  ...NOTES_FAMILY_CASES,
  ...NOTES_CHANNEL_KIND_CASES,
  ...NOTES_CONTENT_UNSUPPORTED_CASES,
  ...DIARY_REMOVED_CASES,
  ...INVITE_LINK_CREDENTIAL_CASES,
  ...JOIN_INVITE_CASES,
  ...ACTIVITY_VOLUME_CASES,
  ...CHANNEL_MEMBERSHIP_CASES,
  ...GROUP_SECTION_CASES,
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
  { name: 'groups invite-link', args: ['groups', 'invite-link', '--help'] },
  {
    name: 'groups join --invite',
    args: ['groups', 'join', '--invite', 'x', '--help'],
  },
  ...['mute', 'unmute', 'volume'].map((command) => ({
    name: `activity ${command}`,
    args: ['activity', command, '--help'],
  })),
  ...[
    'add-section',
    'rename-section',
    'delete-section',
    'move-channel',
    'order-sections',
  ].map((command) => ({
    name: `groups ${command}`,
    args: ['groups', command, '--help'],
  })),
  { name: 'posts react', args: ['posts', 'react', '--help'] },
  { name: 'posts send', args: ['posts', 'send', '--help'] },
  { name: 'posts reply', args: ['posts', 'reply', '--help'] },
  { name: 'posts unreact', args: ['posts', 'unreact', '--help'] },
  { name: 'posts delete', args: ['posts', 'delete', '--help'] },
  { name: 'posts edit', args: ['posts', 'edit', '--help'] },
  { name: 'posts pin', args: ['posts', 'pin', '--help'] },
  { name: 'posts unpin', args: ['posts', 'unpin', '--help'] },
  { name: 'notes status', args: ['notes', 'status', '--help'] },
  { name: 'notes request', args: ['notes', 'request', '--help'] },
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
  { name: 'notes note-publish', args: ['notes', 'note-publish', '--help'] },
  {
    name: 'notes note-unpublish',
    args: ['notes', 'note-unpublish', '--help'],
  },
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
