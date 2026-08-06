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
  notebook: 'Creating the notebook channel…',
  entry: 'Writing the first entry…',
  config: 'Saving the setup…',
} as const;

const ALL_LABELS: ReadonlySet<string> = new Set(Object.values(LABELS));

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
    if (command.includes('channels create')) {
      return LABELS.notebook;
    }
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
  deps: { post: (text: string) => Promise<void> },
  now = Date.now()
): void {
  if (!sessionKey) {
    return;
  }
  armedSessions.set(sessionKey, {
    post: deps.post,
    posted: new Set(),
    expiresAt: now + SETUP_PROGRESS_TTL_MS,
  });
}

export function disarmSetupProgress(sessionKey: string): void {
  armedSessions.delete(sessionKey);
}

/**
 * Post the status line this tool call earns, once per armed setup. Never
 * throws and never blocks — a failed status post must not touch the build.
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
  if (!label || entry.posted.has(label)) {
    return;
  }
  entry.posted.add(label);
  void entry.post(label).catch(() => {
    // A dropped status line is cosmetic; the build carries on.
  });
}
