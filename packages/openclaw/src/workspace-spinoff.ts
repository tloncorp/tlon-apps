import { noteWorkspacePlanTap } from './workspace-plan-tool.js';
import { readWorkspacePlanTap } from './workspace-plan.js';

// Trusted note appended to the owner's DM messages once first-run onboarding
// is over. The same rule lives in the bot's AGENTS.md, but there the model
// answered a trip or study plan inline; next to the message it proposes the
// workspace.
const PROPOSE_NOTE =
  '\n[Workspace rule: if this message starts a topic that will outlast this reply ' +
  '(a project, trip, course, renovation or routine), run `groups list` first. If a ' +
  'workspace already covers it, put its `Ref:` path bare on its own line in your reply ' +
  'instead (once per conversation). Otherwise propose one with tlon_workspace_plan: a ' +
  'short, specific title from the conversation, never a generic one, and the channels ' +
  'and recurring task the topic needs. Do not create it yourself; the owner taps Create. ' +
  'Small talk and one-off questions get no card.]';

/**
 * The note for an owner DM message: what to do about the owner's tap on a
 * workspace card, or else the propose-first rule.
 */
export async function ownerDmWorkspaceNote(
  blob: string | null | undefined
): Promise<string> {
  const tap = readWorkspacePlanTap(blob);
  return tap ? noteWorkspacePlanTap(tap) : PROPOSE_NOTE;
}
