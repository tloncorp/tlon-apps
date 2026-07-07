import type { BotAgentType } from '@tloncorp/api/types/hosting';

export interface SlashCommandOption {
  command: `/${string}`;
  title: string;
  subtitle?: string;
  // Icon NAME string, not an IconType: the shared layer must not depend on
  // @tloncorp/ui, and future hosting-served manifests carry icons as strings.
  // The popup maps the string to an IconType with a 'Command' fallback.
  icon?: string;
  keywords?: string[];
  // Static tiebreaker only; ranking is otherwise driven by the query match.
  priority: number;
  // Defaults to `${command} ` when omitted.
  insertText?: string;
}

export interface SlashCommandManifest {
  agent: BotAgentType;
  commands: SlashCommandOption[];
}

const OPENCLAW_COMMANDS: SlashCommandOption[] = [
  {
    command: '/owner-listen',
    title: 'Owner listen',
    subtitle: 'Let the owner session listen in this channel',
    icon: 'Command',
    keywords: ['owner', 'listen', 'agent'],
    priority: 1,
  },
  {
    command: '/status',
    title: 'Status',
    subtitle: 'Show the current OpenClaw session status',
    icon: 'Info',
    keywords: ['openclaw', 'session', 'model'],
    priority: 2,
  },
  {
    command: '/help',
    title: 'Help',
    subtitle: 'Show available OpenClaw commands',
    icon: 'Info',
    keywords: ['openclaw', 'commands'],
    priority: 3,
  },
  {
    command: '/new',
    title: 'New session',
    subtitle: 'Start a fresh OpenClaw session',
    icon: 'Add',
    keywords: ['reset', 'session', 'openclaw'],
    priority: 4,
  },
  {
    command: '/pending',
    title: 'Pending approvals',
    subtitle: 'List pending DM, channel, and group requests',
    icon: 'Clock',
    keywords: ['approval', 'requests', 'owner'],
    priority: 5,
  },
  {
    command: '/allow',
    title: 'Allow request',
    subtitle: 'Approve a pending request by id',
    icon: 'Checkmark',
    keywords: ['approve', 'approval', 'request'],
    priority: 6,
  },
  {
    command: '/reject',
    title: 'Reject request',
    subtitle: 'Decline a pending request by id',
    icon: 'Close',
    keywords: ['deny', 'decline', 'approval', 'request'],
    priority: 7,
  },
  {
    command: '/ban',
    title: 'Ban request',
    subtitle: 'Block a ship and deny its pending request',
    icon: 'EyeClosed',
    keywords: ['block', 'deny', 'ship', 'approval'],
    priority: 8,
  },
  {
    command: '/banned',
    title: 'Banned ships',
    subtitle: 'List currently banned ships',
    icon: 'EyeClosed',
    keywords: ['blocked', 'ships', 'list'],
    priority: 9,
  },
  {
    command: '/unban',
    title: 'Unban ship',
    subtitle: 'Remove a ship from the ban list',
    icon: 'EyeOpen',
    keywords: ['unblock', 'ship', 'allow'],
    priority: 10,
  },
  {
    command: '/tlon-version',
    title: 'Tlon plugin version',
    subtitle: 'Show the installed OpenClaw Tlon plugin version',
    icon: 'Info',
    keywords: ['version', 'plugin', 'openclaw'],
    priority: 11,
  },
];

const HERMES_COMMANDS: SlashCommandOption[] = [
  {
    command: '/new',
    title: 'New session',
    subtitle: 'Start a fresh Hermes session',
    icon: 'Add',
    keywords: ['reset', 'session', 'hermes'],
    priority: 1,
  },
  {
    command: '/reset',
    title: 'Reset session',
    subtitle: 'Clear the current conversation and start over',
    icon: 'Refresh',
    keywords: ['clear', 'restart', 'session'],
    priority: 2,
  },
  {
    command: '/stop',
    title: 'Stop',
    subtitle: 'Interrupt the current Hermes response',
    icon: 'Stop',
    keywords: ['cancel', 'interrupt', 'halt'],
    priority: 3,
  },
  {
    command: '/status',
    title: 'Status',
    subtitle: 'Show the current Hermes session status',
    icon: 'Info',
    keywords: ['hermes', 'session', 'model'],
    priority: 4,
  },
  {
    command: '/help',
    title: 'Help',
    subtitle: 'Show available Hermes commands',
    icon: 'Info',
    keywords: ['hermes', 'commands'],
    priority: 5,
  },
  {
    command: '/compress',
    title: 'Compress context',
    subtitle: 'Summarize the conversation to free up context',
    icon: 'Filter',
    keywords: ['compact', 'context', 'summarize'],
    priority: 6,
  },
  {
    command: '/model',
    title: 'Model',
    subtitle: 'Show or change the active model',
    icon: 'Settings',
    keywords: ['model', 'provider', 'llm'],
    priority: 7,
  },
  {
    command: '/usage',
    title: 'Usage',
    subtitle: 'Show token usage for the current session',
    icon: 'Clock',
    keywords: ['tokens', 'cost', 'consumption'],
    priority: 8,
  },
  {
    command: '/version',
    title: 'Version',
    subtitle: 'Show the installed Hermes version',
    icon: 'Command',
    keywords: ['version', 'hermes'],
    priority: 9,
  },
];

const STATIC_MANIFESTS: Record<BotAgentType, SlashCommandManifest> = {
  openclaw: { agent: 'openclaw', commands: OPENCLAW_COMMANDS },
  hermes: { agent: 'hermes', commands: HERMES_COMMANDS },
};

export function isBotAgentType(value: unknown): value is BotAgentType {
  return value === 'openclaw' || value === 'hermes';
}

export function getStaticSlashCommandManifest(
  agent: BotAgentType
): SlashCommandManifest {
  // Defensive: a stale persisted keyValue is as untrusted as a network
  // response if the enum ever evolves, so fall back to openclaw for any
  // unrecognized agent value.
  return isBotAgentType(agent)
    ? STATIC_MANIFESTS[agent]
    : STATIC_MANIFESTS.openclaw;
}
