import { ONBOARDING_JOB_NAME } from '../onboarding-job.js';
import type { CampaignState, CampaignTask, StepId } from './model.js';

/**
 * Every piece of tip copy. `{topic}`, `{purpose}` and `{task}` are filled in
 * when a tip is rendered; `{Task}` is `{task}` with a capital first letter.
 */
export type TipCopy = Record<StepId, string> & {
  usefulRequestWithPurpose: string;
  usefulRequestWithTopic: string;
  taskFailed: string;
  taskDelivered: string;
  taskScheduled: string;
  closingAfterFeedback: string;
  closingQuiet: string;
  optOut: string;
  /** How to refer to the onboarding task, whose job name is internal. */
  unnamedTask: string;
};

export const TIP_COPY: TipCopy = {
  'useful-request':
    'What’s one thing you keep looking up? News about a topic, something you’re learning, or a question you’re researching? Give me one and I’ll put together a short answer with sources.\n\nYou can tell me to stop these tips anytime, or send /stop-tips.',
  'recurring-help':
    'One thing you can ask me: ‘Every Friday, find three interesting things about architecture.’ What would your version be?',
  archive:
    'The useful bits can build up here. I can save research in a notebook so you have somewhere to return to it. Your notes and conversations live on your own Tlon node; Tlon can host it, or you can run it yourself. What’s one question you’d like to keep working on?',
  'own-material':
    'I can also work with your own material. Send me a note or a link about a project, and I’ll help you work out what to do next.',
  'task-feedback':
    'How did the last result work for you? We can make it shorter, change what it covers, or send it less often.',
  closing:
    'Want to leave me with one small job for next week? A weekly update on something you care about is a good place to start. I’ll leave you to explore after today.',
  usefulRequestWithPurpose:
    'You chose “{purpose}” during setup. What would you like to focus on? I can help you try it with one useful answer first.',
  usefulRequestWithTopic:
    'You mentioned {topic} during setup. What’s one question about it I could answer for you? I’ll put together a short answer with sources.',
  taskFailed:
    'The last run of {task} failed. Want me to help fix that before we add anything else?',
  taskDelivered:
    'How’s {task} working for you? We can make it shorter, change what it covers, or send it less often.',
  taskScheduled: '{Task} is set up. Would you like to review when it runs?',
  closingAfterFeedback:
    'I’ll leave you to explore after today. You can ask me to adjust your existing tasks whenever you like.',
  closingQuiet:
    'I’ll leave you to explore after today. Whenever something comes up, send it my way.',
  optOut: 'You can tell me to stop these tips anytime, or send /stop-tips.',
  unnamedTask: 'your recurring update',
};

/** How tips refer to a task: its own name, unless it is the internal one. */
export function taskLabel(
  task: CampaignTask | undefined,
  copy: TipCopy = TIP_COPY
): string {
  const name = task?.name.trim();
  return name && name !== ONBOARDING_JOB_NAME ? `“${name}”` : copy.unnamedTask;
}

function fill(
  text: string,
  values: { topic?: string; purpose?: string; task: string }
) {
  const task = values.task;
  return text
    .replaceAll('{topic}', values.topic ?? '')
    .replaceAll('{purpose}', values.purpose ?? '')
    .replaceAll('{Task}', task.charAt(0).toUpperCase() + task.slice(1))
    .replaceAll('{task}', task);
}

export function renderTip(
  step: StepId,
  state: CampaignState,
  task?: CampaignTask,
  copy: TipCopy = TIP_COPY
): string {
  const topic = state.lastReplyAt ? undefined : state.topic;
  let text = copy[step];
  if (!topic && state.purpose && step === 'useful-request')
    text = copy.usefulRequestWithPurpose;
  if (topic && step === 'useful-request') text = copy.usefulRequestWithTopic;
  if (
    step === 'closing' &&
    !task?.failedAt &&
    state.sent.some((s) => s.step === 'task-feedback')
  ) {
    text = copy.closingAfterFeedback;
  } else if (step === 'task-feedback' || (step === 'closing' && task)) {
    text = task?.failedAt
      ? copy.taskFailed
      : task?.deliveredAt
        ? copy.taskDelivered
        : copy.taskScheduled;
  } else if (step === 'closing' && state.status === 'feedback') {
    text = copy.closingQuiet;
  }
  return withOptOut(
    fill(text, { topic, purpose: state.purpose, task: taskLabel(task, copy) }),
    state,
    copy
  );
}

export function withOptOut(
  text: string,
  state: CampaignState,
  copy: TipCopy = TIP_COPY
): string {
  if (!state.sent.length && !text.includes(copy.optOut))
    text += `\n\n${copy.optOut}`;
  return text;
}

/** The owner's message as the agent sees it while a tip is in play. */
export function withCampaignContext(
  context: string | undefined,
  text: string
): string {
  return context ? `${context}\n\n[Current owner message]\n${text}` : text;
}

export function isStopTips(text: string): boolean {
  const value = text.trim();
  return (
    /^\/stop-tips[.!\s]*$/i.test(value) ||
    /^(?:please\s+)?(?:stop|pause|disable|unsubscribe(?:\s+me\s+from)?)(?:\s+sending(?:\s+me)?)?\s+(?:(?:these|the|your|onboarding|campaign|more)\s+)*(?:tips|onboarding messages)(?:\s+please)?[.!\s]*$/i.test(
      value
    ) ||
    /^(?:please\s+)?(?:don['’]t|do not)\s+send\s+(?:me\s+)?(?:any\s+more\s+|more\s+|these\s+)?(?:tips|onboarding messages)[.!\s]*$/i.test(
      value
    )
  );
}
