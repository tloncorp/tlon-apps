import type { LineIconName } from '../../Onboarding/line/lineIcons';

// Every word the first run shows, in one place, so copy can change without
// touching layout or logic. Names that come from live data (the included
// model, a service, a subscription) are passed in.

export type FeaturePoint = {
  icon: LineIconName;
  label: string;
};

/**
 * Where each screen sits in onboarding's eight steps: Profile, Notifications
 * and Setting up come before the first run.
 */
export const FIRST_RUN_STEPS = {
  meet: 4,
  private: 5,
  model: 6,
  connect: 7,
  workspace: 8,
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
  /** The line under the service's name on the services screen. */
  summary: string;
  /** The first line of the access sheet. */
  intro: string;
  accessMode: string;
  access: string;
  account: string;
  /** Who the app is waiting on while it checks a connection. */
  company: string;
  /** The service's box in the services drawing. */
  drawingLabel: string;
};

// In the order the services screen shows them, three at most. Send Gmail
// isn't in the production catalog, so there Notion fills the third row.
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
      summary: 'Sends email once you OK it',
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
    'github',
    {
      scopes: 'read:user user:email repo',
      summary: 'Tracks repos and issues',
      intro:
        'Your Tlonbot will be able to read your repositories and keep track of issues and pull requests for you.',
      accessMode: 'read and write',
      access:
        'Read and change code, issues and pull requests in every repository you can reach, public and private.',
      account: 'The GitHub account you choose next.',
      company: 'GitHub',
      drawingLabel: 'GITHUB',
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
    subtitle: 'It handles the small stuff in the background.',
    points: [
      { icon: 'apps', label: 'Uses your email and calendar, if you let it' },
      { icon: 'phoneOff', label: 'Keeps going when your phone is off' },
      { icon: 'clock', label: 'Takes care of the things you do every week' },
    ] satisfies FeaturePoint[],
    primary: 'Next',
  },

  private: {
    title: 'Yours to keep',
    subtitle: 'Use it however you like, for as long as you like.',
    points: [
      { icon: 'computer', label: 'Runs on a computer we look after' },
      { icon: 'lock', label: 'No training on your data' },
      { icon: 'chatCheck', label: 'Asks before it emails or messages anyone' },
    ] satisfies FeaturePoint[],
    dataLink: 'How your data is kept',
    primary: 'Next',
  },

  // Opened from Yours to keep. The facts match tlon.io/faqs.
  dataKept: {
    title: 'How your data is kept',
    items: [
      {
        icon: 'computer',
        title: 'It has its own computer',
        text: 'Your Tlonbot runs on a computer of its own, not on your phone, with its own memory. We look after it for you.',
      },
      {
        icon: 'sparkle',
        title: 'Models see only what they need',
        text: 'Your Tlonbot remembers your history. The AI company behind the included model sees only what each request needs, and keeps none of it (zero data retention).',
      },
      {
        icon: 'code',
        title: 'The code is open source',
        text: 'Anyone can read how your Tlonbot works, and you can run it on your own computer if you’d rather.',
      },
      {
        icon: 'fileDown',
        title: 'You can take it with you',
        text: 'Export everything it knows, or move it to a computer you run yourself, anytime.',
      },
    ] satisfies { icon: LineIconName; title: string; text: string }[],
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
      'The AI behind your Tlonbot. Switch anytime, and it keeps what it knows.',
    sectionIncluded: 'Free with Tlon',
    sectionSubscription: 'Use your subscription',
    sectionApiKey: 'Use your own API key',
    recommended: 'Recommended',
    includedName: 'Built-in',
    /** The included model's maker and name, from what hosting runs. */
    includedMeta: (model: string) => `Free · ${model}`,
    includedDetail: 'Includes $5 of use every month',
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
    primaryIncluded: 'Use built-in',
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
    title: 'Bring in your friends',
    subtitle:
      'Start a workspace to plan things and get them done together. Your Tlonbots help out.',
    points: [
      { icon: 'people', label: 'Plan trips and projects together' },
      { icon: 'file', label: 'Shares notes and files with everyone' },
      { icon: 'sparkle', label: 'Lets everyone’s Tlonbot pitch in' },
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
