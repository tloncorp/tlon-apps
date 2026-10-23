/**
 * A short human label for the known prompt files; unknown names fall back
 * to the raw file name so new gateway-exposed prompts still render.
 */
export const PROMPT_LABELS: Record<string, string> = {
  'AGENTS.md': 'Instructions',
  'SOUL.md': 'Personality',
  'TOOLS.md': 'Tools',
  'IDENTITY.md': 'Identity',
  'USER.md': 'About you',
  'MEMORY.md': 'Memory',
  'BOOTSTRAP.md': 'Bootstrap',
};

export const PROMPT_DESCRIPTIONS: Record<string, string> = {
  'AGENTS.md': 'Core instructions for how your bot behaves.',
  'SOUL.md': "Your bot's personality and tone.",
  'TOOLS.md': 'Guidance for the tools your bot can use.',
  'IDENTITY.md': 'How your bot identifies itself.',
  'USER.md': 'What your bot knows about you.',
  'MEMORY.md': 'What your bot remembers between conversations.',
  'BOOTSTRAP.md': 'First-run setup instructions for your bot.',
};

export const promptLabel = (name: string) => PROMPT_LABELS[name] ?? name;

export const promptDescription = (name: string) =>
  PROMPT_DESCRIPTIONS[name] ?? 'Additional instructions for your bot.';

const PROMPT_ORDER = [
  'AGENTS.md',
  'SOUL.md',
  'IDENTITY.md',
  'USER.md',
  'MEMORY.md',
  'TOOLS.md',
  'BOOTSTRAP.md',
];

/**
 * Who keeps a file current. Tlon's prompt sync rewrites its files on every
 * gateway start; it seeds memory too, but the bot grows it as it learns.
 */
export type PromptFileKeeper = 'tlon' | 'bot';

const BOT_KEPT_PROMPT_FILES = new Set(['MEMORY.md']);

export const promptFileKeeper = (name: string): PromptFileKeeper =>
  BOT_KEPT_PROMPT_FILES.has(name) ? 'bot' : 'tlon';

const promptOrder = new Map(
  PROMPT_ORDER.map((name, index) => [name, index] as const)
);

export function sortPromptFiles<T extends { name: string }>(prompts: T[]) {
  return [...prompts].sort((a, b) => {
    const aOrder = promptOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = promptOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });
}

/**
 * The files an owner may add to from bot settings. The rest carry what the
 * bot needs to work, and Tlon has to be able to keep changing them.
 */
const EDITABLE_PROMPT_FILES = new Set(['SOUL.md', 'IDENTITY.md']);

// Tlon's prompt sync owns these blocks: on every gateway start it replaces
// each one with the published prompt set's, and keeps whatever is outside
// them. A file with no block at all is replaced whole. These match the sync's
// own patterns (tlonbot's tlawn.py and tlon-hosting-oc's workspace-prompts).
const MANAGED_BLOCK =
  /<!-- idempotency-marker:[^\s]+ -->\n[\s\S]*?\n<!-- \/idempotency-marker -->/g;
const STRAY_MARKER = /<!-- idempotency-marker:[^\s]+ -->\n?/g;
const ANY_MARKER =
  /<!-- (?:idempotency-marker:[^\s]+|\/idempotency-marker) -->/g;
const MARKER_LINE =
  /^<!-- (?:idempotency-marker:[^\s]+|\/idempotency-marker) -->\n?/gm;

const trimNewlines = (text: string) => text.replace(/^\n+|\n+$/g, '');

export type PromptFileParts = {
  /** Tlon's blocks, markers included, in file order. */
  managedBlocks: string[];
  /** Everything outside them: the only text that survives a prompt sync. */
  additions: string;
};

export function splitPromptFile(text: string): PromptFileParts {
  return {
    managedBlocks: text.match(MANAGED_BLOCK) ?? [],
    additions: trimNewlines(
      text.replace(MANAGED_BLOCK, '').replace(STRAY_MARKER, '')
    ),
  };
}

/**
 * The file with its additions replaced and Tlon's blocks kept verbatim, laid
 * out the way the sync writes it so that its next run changes nothing. Marker
 * comments in the additions are dropped: the sync would take them for one of
 * its own blocks and delete what they enclose.
 */
export function joinPromptFile(text: string, additions: string) {
  const own = trimNewlines(additions.replace(ANY_MARKER, ''));
  return [own, ...splitPromptFile(text).managedBlocks]
    .filter(Boolean)
    .join('\n')
    .concat('\n');
}

/** The file as the bot reads it, without the sync's marker comments. */
export const promptDisplayText = (text: string) =>
  trimNewlines(text.replace(MARKER_LINE, ''));

export type PromptFileAccess =
  | { kind: 'read-only'; keptBy: PromptFileKeeper }
  | { kind: 'additions'; additions: string }
  /** Editable in principle, but its blocks are gone, so the sync will
   * replace the file whole and nothing added here would last. */
  | { kind: 'unmanaged' };

export function promptFileAccess(name: string, text: string): PromptFileAccess {
  if (!EDITABLE_PROMPT_FILES.has(name)) {
    return { kind: 'read-only', keptBy: promptFileKeeper(name) };
  }
  const { managedBlocks, additions } = splitPromptFile(text);
  return managedBlocks.length > 0
    ? // Whitespace alone is nothing added.
      { kind: 'additions', additions: additions.trim() ? additions : '' }
    : { kind: 'unmanaged' };
}
