import type {
  SlashCommandManifest,
  SlashCommandOption,
} from '@tloncorp/shared/domain';
import { useCallback, useMemo, useState } from 'react';

export type { SlashCommandManifest, SlashCommandOption };

export interface SlashCommandState {
  isActive: boolean;
  query: string;
}

export interface SlashCommandSelection {
  text: string;
  delta: number;
}

// Commands trigger only at message start (index 0). The leading token runs from
// the initial '/' to the first whitespace; only `[a-zA-Z0-9-]` is allowed in
// it. Anything else — a non-leading slash, a space, an illegal char — makes the
// state inactive. This is the single source of truth for "is the popup open".
export function computeSlashCommandState(
  text: string,
  cursorPosition?: number
): SlashCommandState {
  const inactive: SlashCommandState = { isActive: false, query: '' };

  if (text[0] !== '/') {
    return inactive;
  }

  const whitespaceIndex = text.search(/\s/);
  const token = whitespaceIndex === -1 ? text : text.slice(0, whitespaceIndex);
  if (!/^\/[a-zA-Z0-9-]*$/.test(token)) {
    return inactive;
  }

  // Native TextInput doesn't give us a cursor, so fall back to end-of-text —
  // which degrades the same way mentions do.
  const cursor = cursorPosition ?? text.length;
  if (cursor < 1 || cursor > token.length) {
    return inactive;
  }

  return { isActive: true, query: text.slice(1, cursor) };
}

function slashCommandTier(
  option: SlashCommandOption,
  query: string
): number | null {
  const name = option.command.slice(1).toLowerCase();
  const title = option.title.toLowerCase();
  const keywords = (option.keywords ?? []).map((k) => k.toLowerCase());

  if (name.startsWith(query)) {
    return 0;
  }
  if (title.startsWith(query) || keywords.some((k) => k.startsWith(query))) {
    return 1;
  }
  if (
    name.includes(query) ||
    title.includes(query) ||
    keywords.some((k) => k.includes(query))
  ) {
    return 2;
  }
  return null;
}

// Ranks matches by tier (name-prefix > title/keyword-prefix > substring), then
// by static priority, then alphabetically. Empty query returns everything by
// priority. Case-insensitive.
export function rankSlashCommands(
  commands: SlashCommandOption[],
  query: string
): SlashCommandOption[] {
  const normalized = query.trim().toLowerCase();

  if (normalized.length === 0) {
    return [...commands].sort(
      (a, b) => a.priority - b.priority || a.command.localeCompare(b.command)
    );
  }

  const ranked: { option: SlashCommandOption; tier: number }[] = [];
  for (const option of commands) {
    const tier = slashCommandTier(option, normalized);
    if (tier !== null) {
      ranked.push({ option, tier });
    }
  }

  ranked.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.option.priority - b.option.priority ||
      a.option.command.localeCompare(b.option.command)
  );

  return ranked.map((r) => r.option);
}

// Replaces the entire leading command token with the option's insert text
// (default `${command} `), preserving any text after the token and avoiding a
// double space. Returns the new text and the length delta so callers can shift
// mentions — all of which start at or after the token, since the token contains
// no whitespace.
export function applySlashCommandSelection(
  text: string,
  option: SlashCommandOption
): SlashCommandSelection {
  const whitespaceIndex = text.search(/\s/);
  const tokenLength = whitespaceIndex === -1 ? text.length : whitespaceIndex;
  const after = text.slice(tokenLength);

  let insert = option.insertText ?? `${option.command} `;
  if (/\s$/.test(insert) && /^\s/.test(after)) {
    insert = insert.replace(/\s+$/, '');
  }

  const newText = insert + after;
  return { text: newText, delta: newText.length - text.length };
}

// For in-input highlighting: the leading token must exactly equal a known
// command and be followed by whitespace or end-of-text. Returns the token
// length, or null when there's nothing valid to highlight.
export function getActiveCommandLength(
  text: string,
  commands?: SlashCommandOption[]
): number | null {
  if (!commands || commands.length === 0) {
    return null;
  }
  if (text[0] !== '/') {
    return null;
  }

  const whitespaceIndex = text.search(/\s/);
  const token = whitespaceIndex === -1 ? text : text.slice(0, whitespaceIndex);
  const isCommand = commands.some((c) => c.command === token);
  return isCommand ? token.length : null;
}

const EMPTY_COMMANDS: SlashCommandOption[] = [];

export function useSlashCommands({
  manifest,
}: {
  manifest?: SlashCommandManifest | null;
}) {
  const commands = manifest?.commands ?? EMPTY_COMMANDS;
  const [isSlashCommandModeActive, setIsSlashCommandModeActive] =
    useState(false);
  const [slashCommandQuery, setSlashCommandQuery] = useState('');
  // Single escape-suppression flag: commands only trigger at index 0, so
  // there's just one possible trigger to remember (unlike mentions).
  const [dismissed, setDismissed] = useState(false);

  const rankedSlashCommands = useMemo(
    () =>
      isSlashCommandModeActive
        ? rankSlashCommands(commands, slashCommandQuery)
        : [],
    [isSlashCommandModeActive, commands, slashCommandQuery]
  );

  const hasSlashCommandCandidates = rankedSlashCommands.length > 0;

  const resetSlashCommandMode = useCallback(() => {
    setIsSlashCommandModeActive(false);
    setSlashCommandQuery('');
    setDismissed(false);
  }, []);

  const handleSlashCommandInput = useCallback(
    (text: string, cursorPosition?: number) => {
      // Escape suppression clears the moment the leading slash is gone.
      if (text[0] !== '/') {
        setDismissed(false);
        setIsSlashCommandModeActive(false);
        setSlashCommandQuery('');
        return;
      }

      if (dismissed) {
        setIsSlashCommandModeActive(false);
        return;
      }

      const state = computeSlashCommandState(text, cursorPosition);
      setIsSlashCommandModeActive(state.isActive);
      setSlashCommandQuery(state.query);
    },
    [dismissed]
  );

  const handleSelectSlashCommand = useCallback(
    (option: SlashCommandOption, text: string): SlashCommandSelection => {
      const selection = applySlashCommandSelection(text, option);
      resetSlashCommandMode();
      return selection;
    },
    [resetSlashCommandMode]
  );

  const handleSlashCommandEscape = useCallback(() => {
    setIsSlashCommandModeActive(false);
    setDismissed(true);
  }, []);

  return {
    isSlashCommandModeActive,
    slashCommandQuery,
    rankedSlashCommands,
    hasSlashCommandCandidates,
    handleSlashCommandInput,
    handleSelectSlashCommand,
    handleSlashCommandEscape,
    resetSlashCommandMode,
  };
}
