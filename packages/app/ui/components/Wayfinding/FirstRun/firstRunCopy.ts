import type { LineIconName } from '../../Onboarding/line/lineIcons';

// Every word the first run shows, in one place, so copy can change without
// touching layout or logic. Names that come from live data (the included
// model, a service, a subscription) are passed in.

export type FeaturePoint = {
  icon: LineIconName;
  label: string;
};

/**
 * Where each screen sits in onboarding's nine steps: Profile, the two
 * notification screens and Setting up come before the first run.
 */
export const FIRST_RUN_STEPS = {
  meet: 5,
  private: 6,
  connect: 7,
  model: 8,
  workspace: 9,
} as const;

/**
 * What a featured service lets the Tlonbot do, in plain words. Each entry
 * describes one exact scope set from the live catalog; if the catalog's scopes
 * change, the service drops out of the featured rows (it stays under All
 * services) until this copy is checked again. Featured rows crop the
 * catalog logo to its middle square, so check a new service's logo fits.
 */
export type ServiceAccessCopy = {
  scopes: string;
  /** The line under the service's name on screen 3. */
  summary: string;
  /** The first line of the access sheet. */
  intro: string;
  accessMode: string;
  access: string;
  account: string;
  /** Who the app is waiting on while it checks a connection. */
  company: string;
  /** The service's box in screen 3's drawing. */
  drawingLabel: string;
};

export const FIRST_RUN_FEATURED_SERVICES: [string, ServiceAccessCopy][] = [
  [
    'google-calendar',
    {
      scopes: 'openid email profile https://www.googleapis.com/auth/calendar',
      summary: 'Helps plan your week',
      intro:
        'Your Tlonbot will be able to check your schedule and add events for you.',
      accessMode: 'read and write',
      access: 'See, edit, share and delete all the calendars you can access.',
      account: 'The Google account you choose next.',
      company: 'Google',
      drawingLabel: 'CALENDAR',
    },
  ],
  [
    'google-gmail',
    {
      scopes: 'openid email profile https://www.googleapis.com/auth/gmail.send',
      summary: 'Sends email for you',
      intro:
        'Your Tlonbot will be able to send email from your Gmail address when you ask.',
      accessMode: 'send only',
      access: 'Send email as you. It can’t read, change or delete your email.',
      account: 'The Google account you choose next.',
      company: 'Google',
      drawingLabel: 'MAIL',
    },
  ],
  [
    'notion',
    {
      scopes: '',
      summary: 'Finds and edits notes',
      intro:
        'Your Tlonbot will be able to search your Notion pages and make changes for you.',
      accessMode: 'read and write',
      access: 'Read, create and edit pages in the Notion workspace you pick.',
      account: 'The Notion workspace you choose next.',
      company: 'Notion',
      drawingLabel: 'NOTION',
    },
  ],
];

export const firstRunCopy = {
  back: 'Back',

  meet: {
    title: 'Meet your Tlonbot',
    subtitle:
      'Unlike ChatGPT, it works in your chats and keeps what it learns when you switch models.',
    points: [
      { icon: 'chats', label: 'Catches you up on a busy chat' },
      { icon: 'search', label: 'Looks things up and plans ahead' },
      { icon: 'plug', label: 'Works with your calendar and email' },
    ] satisfies FeaturePoint[],
    primary: 'Next',
  },

  private: {
    title: 'Yours to keep',
    subtitle:
      'Private by design, and you can take it with you whenever you want.',
    points: [
      { icon: 'computer', label: 'Runs on its own computer in the cloud' },
      { icon: 'lock', label: 'Its default model keeps nothing' },
      { icon: 'sliders', label: 'Sees only what you share' },
    ] satisfies FeaturePoint[],
    dataLink: 'How your data is kept',
    primary: 'Next',
  },

  // Opened from Yours to keep. The facts match tlon.io/faqs.
  dataKept: {
    title: 'How your data is kept',
    subtitle: 'Where it runs, and who can see what.',
    items: [
      {
        label: 'Where it runs',
        text: 'On its own computer in the cloud. Tlon runs it for you, and it belongs to you.',
      },
      {
        label: 'Who can see it',
        text: 'Your chats and its memory stay there. Tlon only looks if you ask for help and say yes.',
      },
      {
        label: 'The AI model',
        text: 'Your Tlonbot sends the model only what it needs to answer. The included model keeps none of it.',
      },
      {
        label: 'Open source',
        text: 'The code that runs your Tlonbot is open, so anyone can check how it works.',
      },
      {
        label: 'Leaving',
        text: 'Export everything, or move it to a computer you run yourself, anytime.',
      },
    ],
    faqLink: 'Read the full answers at tlon.io/faqs',
    faqUrl: 'https://tlon.io/faqs',
    primary: 'Done',
  },

  connect: {
    title: 'Connect your services',
    subtitle:
      'Pick what you’d like help with. You can skip this and connect later.',
    none: 'No services are available to connect right now. You can connect one later from your Tlonbot’s settings.',
    allServices: 'All services',
    connectButton: 'Connect',
    tryAgainButton: 'Try again',
    checkAgainButton: 'Check again',
    connectedBadge: 'Connected',
    connectingLine: 'Waiting for you to finish signing in…',
    connectedLine: 'Connected. Nothing has been imported or shared.',
    cancelledLine: 'Not connected. Try again, or continue without it.',
    failedLine: 'Couldn’t connect. Try again, or continue without it.',
    checkingLine: (service: string) => `Still checking with ${service}.`,
    checkingA11y: 'Checking',
    primaryConnected: 'Continue',
    primaryNone: 'Continue without connecting',
  },

  accessSheet: {
    title: (service: string) => `Connect ${service}`,
    accessLabel: (mode: string) => `Access requested · ${mode}`,
    accountLabel: 'Account',
    disconnectLabel: 'Turning it off',
    disconnectLine:
      'Disconnect any time in your Tlonbot’s settings, under Connect services.',
    footnote:
      'Connecting does not invite anyone or automatically share this content in a workspace.',
    continue: (service: string) => `Continue to ${service}`,
    cancel: 'Cancel',
  },

  model: {
    title: 'You choose the model',
    subtitle:
      'Pick the model, and switch whenever you want. Your Tlonbot keeps its history.',
    sectionIncluded: 'Free with Tlon',
    sectionSubscription: 'Use your subscription',
    sectionApiKey: 'Use your own API key',
    recommended: 'Recommended',
    includedMeta: 'Free · $5 of credit every month',
    subscriptionMeta: (company: string) =>
      `Sign in with your plan · ${company}’s data policy`,
    apiKeyName: 'Your own API key',
    apiKeyMeta: 'For developers · you pay the provider',
    subscriptionsName: 'Your subscription',
    subscriptionsMeta: (plans: string[]) =>
      `A ${
        plans.length > 1
          ? `${plans.slice(0, -1).join(', ')} or ${plans[plans.length - 1]}`
          : plans[0]
      } plan you pay for`,
    primarySubscriptions: 'Sign in to your subscription',
    primaryIncluded: (model: string) => `Use ${model}`,
    primarySubscription: (plan: string) => `Sign in to ${plan}`,
    primaryApiKey: 'Add your API key',
    a11yGroup: 'How your Tlonbot gets a model',
    switchFailed: (name: string) =>
      `Couldn’t switch your Tlonbot to ${name}. Go back to try again.`,
    switchFailedLater: (name: string) =>
      `Couldn’t switch your Tlonbot to ${name}. You can change models in its settings.`,
  },

  switchSheet: {
    subscriptionTitle: (plan: string) => `Use your ${plan} subscription?`,
    apiKeyTitle: 'Use your own API key?',
    noZdrTitle: 'Zero data retention doesn’t apply',
    noZdrSubscription: (company: string) =>
      `Your messages go to ${company} under its own data policy.`,
    noZdrApiKey:
      'Your messages go to the provider you pick, under its own data policy.',
    planTitle: (plan: string) => `Uses your ${plan} plan`,
    keyTitle: 'You pay the provider',
    fallback: (model: string) => `If it’s unavailable, ${model} steps in.`,
    sameBotTitle: 'Your Tlonbot stays the same',
    sameBotDetail: 'Same history and context. You can switch back any time.',
    continueSubscription: (plan: string) => `Continue to ${plan}`,
    continueApiKey: 'Add an API key',
    waitingForBot: 'Waiting for your Tlonbot…',
    planChoice: 'Which subscription',
    keep: (model: string) => `Keep ${model}`,
  },

  apiKey: {
    title: 'Add your API key',
    subtitle:
      'Pick the provider, then paste your key. It’s stored on your Tlon computer.',
    providerLabel: 'Provider',
    keyLabel: (provider: string) => `${provider} API key`,
    keyPlaceholder: 'Paste your key here',
    paste: 'Paste',
    primary: 'Check key',
    checking: 'Checking…',
  },

  workspace: {
    title: 'Start a workspace',
    subtitle: 'Make a place for your team, friends, and bot to talk and share.',
    // What onboarding's home group holds: its General chat and Updates
    // notebook.
    points: [
      { icon: 'hash', label: 'A chat to work in' },
      { icon: 'notebook', label: 'A notebook for updates' },
      { icon: 'people', label: 'Invite people when you’re ready' },
    ] satisfies FeaturePoint[],
    primary: 'Invite friends',
    secondary: 'Skip for now',
  },

  setup: {
    // The screen keeps signup's "Setting up" title, so "Getting your Tlonbot
    // ready…" leads the body instead.
    waitingBody:
      'Getting your Tlonbot ready… Your choices are saved, and your chat opens as soon as it’s ready.',
  },
};
