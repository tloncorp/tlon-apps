import type {
  CampaignConfig,
  CampaignState,
  CampaignTask,
  StepId,
} from './model.js';

// Useful-first sequence with one archive/ownership message. Rollout is default-off.
export const TEMPLATES: Record<StepId, string> = {
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
};

export function renderTip(
  step: StepId,
  state: CampaignState,
  config: CampaignConfig,
  task?: CampaignTask
): string {
  const topic = state.lastReplyAt ? undefined : state.topic;
  let text = TEMPLATES[step];
  if (!topic && state.purpose && step === 'useful-request')
    text = `You chose “${state.purpose}” during setup. What would you like to focus on? I can help you try it with one useful answer first.`;
  if (topic && step === 'useful-request')
    text = `You mentioned ${topic} during setup. What’s one question about it I could answer for you? I’ll put together a short answer with sources.`;
  if (
    step === 'closing' &&
    !task?.failedAt &&
    state.sent.some((s) => s.step === 'task-feedback')
  ) {
    text =
      'I’ll leave you to explore after today. You can ask me to adjust your existing tasks whenever you like.';
  } else if (step === 'task-feedback' || (step === 'closing' && task)) {
    text = task?.failedAt
      ? `The last run or delivery of “${task.name}” failed. Want me to help fix that before we add anything else?`
      : task?.deliveredAt
        ? `How’s “${task.name}” working for you? We can make it shorter, change what it covers, or send it less often.`
        : `You have “${task?.name ?? 'a recurring task'}” set up. Would you like to review its schedule?`;
  } else if (step === 'closing' && state.status === 'feedback') {
    text =
      'I’ll leave you to explore after today. Whenever something comes up, send it my way.';
  }
  const override = config.copy?.[step];
  if (override)
    text = override
      .replaceAll('{topic}', topic ?? 'your interests')
      .replaceAll('{task}', task?.name ?? 'your task');
  return withOptOut(text, state);
}

export function withOptOut(text: string, state: CampaignState): string {
  if (!state.sent.length && !text.includes('stop these tips'))
    text +=
      '\n\nYou can tell me to stop these tips anytime, or send /stop-tips.';
  return text;
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
