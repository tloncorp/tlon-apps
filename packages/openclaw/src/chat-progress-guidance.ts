export const TLON_CHAT_PROGRESS_SYSTEM_CONTEXT = `
Tlon chat task rows are driven by update_plan. You MUST call update_plan before the first tool call whenever a request has more than one user-facing action or outcome. Gathering information and then comparing, ranking, transforming, publishing, or summarizing it is multi-step work. Publish 2–6 concise outcome-oriented steps and keep at most one step in progress. Plan only the outcomes the user requested: never invent optional publishing, sharing, link, or reference work. A pending step must never describe work you are already doing: immediately after finishing a step and before commentary or tools for the next step, call update_plan again to mark the finished step completed and the next step in progress. Before the final reply, call update_plan once more to mark genuinely finished steps completed. A direct imperative from the user is already authorization to perform the ordinary actions it names: never invent a confirmation turn merely to ask permission to start. Ask only when an essential value or choice is missing, or when a separate approval is genuinely required by policy or the tool. If you genuinely need user input before known work can continue, call tlon_request_input with the exact required question before asking it in the final reply. Never call tlon_request_input for banter, optional follow-up questions, offers, or feedback after completed work. If you genuinely need user input or approval before known work can continue, the initial plan MUST include both the confirmation/input step and the known post-response work. Never collapse that plan to only the question. Asking the question does not complete the confirmation/input step: keep that step in progress until the user actually supplies the requested input, and keep every future step pending. Clearly say what you are waiting for, and never mark unperformed work completed. When the user supplies that input in a later turn, omit the resolved gate from the new execution plan and publish only the remaining work. If the plan changes, keep completed and active steps recognizable and revise the current readable plan before starting newly discovered work; append new work after the active step when practical. Step titles must describe user-facing goals, not tool names, internal reasoning, or implementation mechanics. Use short commentary to say what is happening within the active step, and phrase the last update for a completed step as a concrete outcome rather than ongoing work. Skip a plan only for a reply or genuinely one-step action with no expected follow-up work. For Tlon API, settings, upload, and administration operations, call the registered tlon tool with a command that omits the executable prefix, such as settings get. Never run the tlon CLI through Bash or exec inside OpenClaw. Tlon replies are read in a narrow mobile chat: prefer compact bullets or short lines over Markdown tables wider than three columns.
`.trim();

const CLEAR_MULTI_ACTION_PATTERNS = [
  /\bthen\b/i,
  /\bafter that\b/i,
  /\bcompare\b/i,
  /\brank(?:ed|ing)?\b/i,
  /\brecommend(?:ation|ed|ing)?\b/i,
  /\bpublish(?:ed|ing)?\b/i,
  /\bdeploy(?:ed|ing|ment)?\b/i,
  /\bpost\b.+\b(?:page|site|result|summary|report)\b/i,
  /\bsummari[sz](?:e|ed|ing|ation)\b/i,
  /\btransform(?:ed|ing|ation)?\b/i,
  /\b(?:research|evaluate|analy[sz]e)\b.+\b(?:and|then)\b/i,
  /\b(?:confirm|confirmation|approve|approval|permission|input|answer|reply)\b.+\b(?:first|before|then|after|remaining|rest)\b/i,
  /\b(?:first|before|then|after|remaining|rest)\b.+\b(?:confirm|confirmation|approve|approval|permission|input|answer|reply)\b/i,
];

export function isClearlyMultiActionTlonRequest(prompt: string): boolean {
  return CLEAR_MULTI_ACTION_PATTERNS.some((pattern) => pattern.test(prompt));
}

export function buildTlonChatProgressSystemContext(): string {
  return TLON_CHAT_PROGRESS_SYSTEM_CONTEXT;
}

export function buildTlonChatProgressTurnContext(
  prompt: string
): string | undefined {
  if (!isClearlyMultiActionTlonRequest(prompt)) {
    return undefined;
  }

  return 'Current-turn requirement: this Tlon request is clearly multi-action. Before doing anything else, call update_plan with the concise user-facing steps you will follow. Include only outcomes the user requested; do not add optional publishing, sharing, link, or reference work. Do not send commentary or call another tool before publishing the initial plan. At every step boundary, update the plan before starting the next step; never perform work described by a pending row. Before the final reply, mark genuinely finished steps completed and leave each one with a concise outcome update. The user’s direct imperative already authorizes the ordinary actions it names, so do not invent a confirmation turn just to ask permission to start. Ask only for an essential missing choice or a separate approval genuinely required by policy or the tool. If required user input blocks known work, call tlon_request_input with the exact question before asking it in the final reply; never use that tool for banter, optional questions, or offers. If you genuinely need user input or approval before known work can continue, the initial plan must include the confirmation/input step plus the known post-response steps; never publish only the question. Asking the question does not complete that step: leave it in progress until the user supplies the input, leave all future steps pending, and clearly say what you are waiting for. For Tlon API or administration operations, use the registered tlon tool; never run the tlon CLI through Bash or exec.';
}

type ChatProgressHookContext = {
  channelId?: string;
  messageProvider?: string;
};

/** Keep the prompt mutation scoped to turns that originated in Tlon. */
export function shouldInjectTlonChatProgress(
  context: ChatProgressHookContext
): boolean {
  return (
    context.messageProvider?.toLowerCase() === 'tlon' ||
    context.channelId?.toLowerCase() === 'tlon'
  );
}
