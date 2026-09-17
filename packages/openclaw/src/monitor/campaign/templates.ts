import type { StepId } from './model.js';

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
  closing:
    'Want to leave me with one small job for next week? A weekly update on something you care about is a good place to start. I’ll leave you to explore after today.',
};

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
