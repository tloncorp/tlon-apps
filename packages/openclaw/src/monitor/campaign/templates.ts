import type {
  CampaignConfig,
  CampaignState,
  CampaignTask,
  Direction,
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

export const RECURRING_OFFER = 'Would this be useful every week?';

const ALTERNATIVES: Record<Direction, Partial<Record<StepId, string>>> = {
  useful: {},
  archive: {
    'useful-request':
      'Have a link you meant to come back to, or an idea you don’t want to lose? Send it to me. I can help turn it into a note you can keep building on.',
    'recurring-help':
      'Your notes and conversations in Tlon Messenger live on your own personal server, called a node. Tlon can host it for you, or you can export it and run it yourself. Want a quick explanation of how that works?',
    archive:
      'What would you like to start a notebook about? A project, something you’re learning, or a collection of ideas?',
    'own-material':
      'You can give me a notebook that grows over time: “Every week, teach me one thing about gardening and save it here.” What would you want yours to cover?',
    closing:
      'You can change the AI model you use here and keep your conversations and notes. Whenever something comes up, send it my way—even if you don’t know exactly what help you need.',
  },
  routine: {
    'useful-request':
      'What’s something you’re working on this week? It can be small. Tell me a little about it and I’ll help you find a useful next step.',
    'recurring-help':
      'I can help you learn something, research a decision, or organize a project. Which sounds useful right now?',
    archive:
      'A recurring task can be as simple as: “Every Sunday, ask me what I want to get done this week.” Want to try that?',
    'own-material':
      'If you keep project notes somewhere else, I can check which supported services are available to you. Want me to show you the options?',
    closing:
      'I’ll leave you to explore after today. Whenever something comes up, send it my way—even if you don’t know exactly what help you need.',
  },
};
export function renderTip(
  step: StepId,
  state: CampaignState,
  config: CampaignConfig,
  task?: CampaignTask
): string {
  const direction = state.direction ?? 'useful';
  const topic = state.lastReplyAt ? undefined : state.topic;
  let text = ALTERNATIVES[direction][step] ?? TEMPLATES[step];
  if (!topic && state.purpose && step === 'useful-request')
    text = `You chose “${state.purpose}” during setup. What would you like to focus on? I can help you try it with one useful answer first.`;
  if (topic && step === 'useful-request') {
    text =
      direction === 'archive'
        ? `You mentioned ${topic} during setup. Have a link or idea about it you’d like to keep building on?`
        : `You mentioned ${topic} during setup. What’s one question about it I could answer for you? I’ll put together a short answer with sources.`;
  }
  if (topic && direction === 'routine' && step === 'recurring-help')
    text = `For ${topic}, would research, a reminder, or a place to organize your notes help most?`;
  if (topic && direction === 'archive' && step === 'archive')
    text = `We could start a small collection about ${topic}. I can find useful sources and save a short explanation in a notebook. Want me to?`;
  if (topic && direction === 'archive' && step === 'own-material')
    text = `Want a notebook about ${topic} to keep growing? Each week I can research one question and add an update with sources. You choose the day.`;
  if (topic && direction === 'routine' && step === 'archive')
    text = `Would a weekly check-in on ${topic} help? I can ask how it’s going, then help you work out the next step. What day would suit you?`;
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
  } else if (
    step === 'closing' &&
    (state.status === 'feedback' || state.status === 'converted')
  ) {
    text =
      'I’ll leave you to explore after today. Whenever something comes up, send it my way.';
  }
  if (step === 'closing' && !task && state.offeredAt)
    text =
      'I’ll leave you to explore after today. Whenever something comes up, send it my way.';
  const override = config.copy?.[step];
  if (override)
    text = override
      .replaceAll('{topic}', topic ?? 'your interests')
      .replaceAll('{task}', task?.name ?? 'your task');
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
