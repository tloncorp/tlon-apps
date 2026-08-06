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
export function setupProgressLabelFor(
  toolName: string,
  params: unknown
): string | null {
  const command =
    typeof (params as { command?: unknown })?.command === 'string'
      ? (params as { command: string }).command ?? ''
      : '';
  if (toolName === 'cron') {
    return 'Scheduling the daily job…';
  }
  if (/search/i.test(toolName)) {
    return 'Searching the web…';
  }
  if (/image|imagine|paint|dall/i.test(toolName)) {
    return 'Generating the group icon…';
  }
  if (toolName === 'tlon') {
    if (command.includes('channels create')) {
      return 'Creating the notebook channel…';
    }
    if (command.includes('note-create')) {
      return 'Writing the first entry…';
    }
    if (command.includes('groups update')) {
      if (command.includes('--description')) {
        return 'Saving the setup…';
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
