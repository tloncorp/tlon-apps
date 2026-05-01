import { type IconType } from '@tloncorp/ui';
import { useMemo, useState } from 'react';

export interface SlashCommandOption {
  command: `/${string}`;
  title: string;
  subtitle?: string;
  icon: IconType;
  keywords?: string[];
  priority: number;
  insertText?: string;
}

export const DEFAULT_SLASH_COMMANDS: SlashCommandOption[] = [
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

function matchesCommand(option: SlashCommandOption, query: string) {
  if (query.trim().length === 0) {
    return true;
  }

  const normalized = query.toLowerCase();
  const command = option.command.slice(1).toLowerCase();
  const title = option.title.toLowerCase();
  const keywords = option.keywords ?? [];

  return (
    command.includes(normalized) ||
    title.includes(normalized) ||
    keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
  );
}

export const useSlashCommands = (
  commands: SlashCommandOption[] = DEFAULT_SLASH_COMMANDS
) => {
  const [isSlashCommandModeActive, setIsSlashCommandModeActive] =
    useState(false);
  const [slashCommandStartIndex, setSlashCommandStartIndex] = useState<
    number | null
  >(null);
  const [slashCommandSearchText, setSlashCommandSearchText] = useState('');
  const [wasDismissedByEscape, setWasDismissedByEscape] = useState(false);
  const [lastDismissedTriggerIndex, setLastDismissedTriggerIndex] = useState<
    number | null
  >(null);

  const validSlashCommands = useMemo(() => {
    return commands
      .filter((option) => matchesCommand(option, slashCommandSearchText))
      .sort((a, b) => a.priority - b.priority);
  }, [commands, slashCommandSearchText]);

  const hasSlashCommandCandidates = validSlashCommands.length > 0;

  const resetSlashCommand = () => {
    setIsSlashCommandModeActive(false);
    setSlashCommandStartIndex(null);
    setSlashCommandSearchText('');
  };

  const handleSlashCommand = (
    oldText: string,
    newText: string,
    cursorPositionOverride?: number
  ) => {
    // Mirrors the mention parser. When the input can provide a cursor position
    // we use it; otherwise we infer the edit point from the text diff for native
    // TextInput compatibility.
    let cursorPosition = cursorPositionOverride ?? newText.length;
    if (cursorPositionOverride == null && oldText.length !== newText.length) {
      for (let i = 0; i < Math.min(oldText.length, newText.length); i++) {
        if (oldText[i] !== newText[i]) {
          cursorPosition = i + (newText.length > oldText.length ? 1 : 0);
          break;
        }
      }
    }

    if (
      oldText.length < newText.length &&
      newText[cursorPosition - 1]?.match(/\s/)
    ) {
      setWasDismissedByEscape(false);
    }

    if (wasDismissedByEscape && lastDismissedTriggerIndex !== null) {
      if (
        oldText.length > newText.length &&
        cursorPosition <= lastDismissedTriggerIndex
      ) {
        setWasDismissedByEscape(false);
        setLastDismissedTriggerIndex(null);
      }
    }

    if (newText.length < oldText.length && isSlashCommandModeActive) {
      const deletedChar = oldText[cursorPosition];
      if (deletedChar === '/') {
        resetSlashCommand();
        return;
      }
    }

    const beforeCursor = newText.slice(0, cursorPosition);
    const afterCursor = newText.slice(cursorPosition);
    const lastSlashIndex = beforeCursor.lastIndexOf('/');

    if (lastSlashIndex < 0) {
      resetSlashCommand();
      return;
    }

    const textBetweenSlashAndCursor = beforeCursor.slice(lastSlashIndex + 1);
    const textBeforeSlash = beforeCursor.slice(
      lastSlashIndex - 1,
      lastSlashIndex
    );
    const whitespaceBeforeOrFirst =
      lastSlashIndex === 0 || !!textBeforeSlash.match(/\s/);
    const spaceAfterSlash = textBetweenSlashAndCursor.match(/\s/);
    const isDismissedTrigger =
      wasDismissedByEscape && lastSlashIndex === lastDismissedTriggerIndex;

    if (
      whitespaceBeforeOrFirst &&
      !spaceAfterSlash &&
      !isDismissedTrigger &&
      (cursorPosition === lastSlashIndex + 1 ||
        (cursorPosition > lastSlashIndex && !/\s/.test(afterCursor)))
    ) {
      setIsSlashCommandModeActive(true);
      setSlashCommandStartIndex(lastSlashIndex);
      setSlashCommandSearchText(textBetweenSlashAndCursor);
    } else {
      resetSlashCommand();
    }
  };

  const handleSelectSlashCommand = (
    option: SlashCommandOption,
    text: string
  ) => {
    if (slashCommandStartIndex === null) {
      return;
    }

    const insertText = option.insertText ?? option.command;
    const beforeSlash = text.slice(0, slashCommandStartIndex);
    const afterSlash = text.slice(
      slashCommandStartIndex + slashCommandSearchText.length + 1
    );
    const spacer = insertText.endsWith(' ') ? '' : ' ';
    const newText = `${beforeSlash}${insertText}${spacer}${afterSlash}`;

    resetSlashCommand();
    setWasDismissedByEscape(false);
    setLastDismissedTriggerIndex(null);

    return newText;
  };

  const handleSlashCommandEscape = () => {
    resetSlashCommand();
    setWasDismissedByEscape(true);
    setLastDismissedTriggerIndex(slashCommandStartIndex);
  };

  return {
    validSlashCommands,
    slashCommandSearchText,
    handleSlashCommand,
    handleSelectSlashCommand,
    handleSlashCommandEscape,
    isSlashCommandModeActive,
    hasSlashCommandCandidates,
  };
};
