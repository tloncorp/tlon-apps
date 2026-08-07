/**
 * Interstitial progress lines for the agent-onboarding setup, driven by the
 * tool calls the build actually makes rather than by model narration.
 *
 * The setup directive orders the model to work in silence (its narration is
 * chat spam and it never reliably says the *useful* thing), which leaves the
 * owner staring at a still channel for the minutes a build takes. The plugin
 * can do better than the model here: it sees every tool call, so it can post
 * a short, truthful status line when the build reaches a recognizable step —
 * each one once, in Tlon-authored copy.
 *
 * The monitor arms a session when it dispatches a setup directive and
 * disarms it when the setup's closing settles; the `before_tool_call` hook
 * feeds every tool call through `noteToolCallForSetupProgress`, which is a
 * no-op for sessions that aren't armed.
 */

type SetupProgressEntry = {
  post: (text: string) => Promise<void>;
  presence?: (toolName: string, label: string) => void;
  posted: Set<string>;
  expiresAt: number;
};

/** A build should never hold an armed session longer than this. */
const SETUP_PROGRESS_TTL_MS = 20 * 60_000;

const armedSessions = new Map<string, SetupProgressEntry>();

/**
 * The status line a tool call earns, or null for calls not worth a message.
 * Matching is deliberately loose string containment on the command text:
 * the tlon tool takes a free-form command string, and these only gate
 * cosmetic lines — a miss costs a status update, never correctness.
 */
const LABELS = {
  cron: 'Scheduling the daily job…',
  search: 'Searching the web…',
  icon: 'Generating the group icon…',
  entry: 'Writing the first entry…',
  // Not "Saving the setup…". The config write is what *causes* the owner's
  // app to make the notebook, so it now lands well before the first entry
  // does — a line that reads as the final step left the owner looking at a
  // finished-sounding setup and an empty notebook.
  config: 'Setting up your group…',
} as const;

/**
 * Posted by the sweep, not by a tool call: the gap between the config write
 * and the first entry is the owner's app creating the notebook, which no
 * tool call marks. Without it the build goes quiet at exactly the moment the
 * owner is most likely to conclude it has stalled.
 *
 * Counted as a progress line (below) so the setup-survival check doesn't
 * mistake it for the bot speaking.
 */
export const WAITING_FOR_NOTEBOOK_LINE = 'Waiting for your notebook…';

const ALL_LABELS: ReadonlySet<string> = new Set([
  ...Object.values(LABELS),
  WAITING_FOR_NOTEBOOK_LINE,
]);

/**
 * Whether a post is one of the plugin-authored status lines above. The
 * onboarding state machine needs to tell these apart from the model's own
 * speech: a setup-survival check that counted a status line as "the bot
 * replied" would read a dead directive turn as alive and never retry it.
 */
export function isSetupProgressLine(text: string): boolean {
  return ALL_LABELS.has(text.trim());
}

export function setupProgressLabelFor(
  toolName: string,
  params: unknown
): string | null {
  const command =
    typeof (params as { command?: unknown })?.command === 'string'
      ? (params as { command: string }).command ?? ''
      : '';
  if (toolName === 'cron') {
    return LABELS.cron;
  }
  if (/search/i.test(toolName)) {
    return LABELS.search;
  }
  if (/image|imagine|paint|dall/i.test(toolName)) {
    return LABELS.icon;
  }
  if (toolName === 'tlon') {
    // No line for `channels create`: the notebook is the owner's channel
    // now, and a build that creates one is misbehaving — announcing it
    // would dress a bug up as progress.
    if (command.includes('note-create')) {
      return LABELS.entry;
    }
    if (command.includes('groups update')) {
      if (command.includes('--description')) {
        return LABELS.config;
      }
      return null;
    }
  }
  return null;
}

export function armSetupProgress(
  sessionKey: string,
  deps: {
    post: (text: string) => Promise<void>;
    /**
     * Reflect the current step into the channel's thinking indicator —
     * called on every recognized tool call (the presence tracker dedupes),
     * where `post` fires once per label.
     */
    presence?: (toolName: string, label: string) => void;
  },
  now = Date.now()
): void {
  if (!sessionKey) {
    return;
  }
  armedSessions.set(sessionKey, {
    post: deps.post,
    presence: deps.presence,
    posted: new Set(),
    expiresAt: now + SETUP_PROGRESS_TTL_MS,
  });
}

export function disarmSetupProgress(sessionKey: string): void {
  armedSessions.delete(sessionKey);
}

/**
 * Post the status line this tool call earns, once per armed setup, and
 * keep the thinking indicator naming the current step. Never throws and
 * never blocks — a failed status post must not touch the build.
 */
export function noteToolCallForSetupProgress(
  sessionKey: string | undefined,
  toolName: string,
  params: unknown,
  now = Date.now()
): void {
  if (!sessionKey) {
    return;
  }
  const entry = armedSessions.get(sessionKey);
  if (!entry) {
    return;
  }
  if (now > entry.expiresAt) {
    armedSessions.delete(sessionKey);
    return;
  }
  const label = setupProgressLabelFor(toolName, params);
  if (!label) {
    return;
  }
  try {
    entry.presence?.(toolName, label.replace(/…$/, ''));
  } catch {
    // Presence is cosmetic too.
  }
  if (entry.posted.has(label)) {
    return;
  }
  entry.posted.add(label);
  void entry.post(label).catch(() => {
    // A dropped status line is cosmetic; the build carries on.
  });
}
