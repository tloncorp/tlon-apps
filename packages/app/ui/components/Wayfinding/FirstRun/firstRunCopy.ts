// Every word the first run shows, in one place, so copy can change without
// touching layout or logic. Names that come from live data (the included
// model, a service, a subscription) are passed in.

export type FeaturePointIcon =
  | 'chat'
  | 'people'
  | 'plug'
  | 'computer'
  | 'lock'
  | 'sliders';

export type FeaturePoint = {
  icon: FeaturePointIcon;
  title: string;
  detail: string;
};

export const FIRST_RUN_STEP_COUNT = 5;

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
};

export const FIRST_RUN_FEATURED_SERVICES: [string, ServiceAccessCopy][] = [
  [
    'google-calendar',
    {
      scopes: 'openid email profile https://www.googleapis.com/auth/calendar',
      summary: 'See your events and add new ones.',
      intro:
        'Your Tlonbot will be able to check your schedule and add events for you.',
      accessMode: 'read and write',
      access: 'See, edit, share and delete all the calendars you can access.',
      account: 'The Google account you choose next.',
      company: 'Google',
    },
  ],
  [
    'google-gmail',
    {
      scopes: 'openid email profile https://www.googleapis.com/auth/gmail.send',
      summary: 'Send email as you. Can’t read your inbox.',
      intro:
        'Your Tlonbot will be able to send email from your Gmail address when you ask.',
      accessMode: 'send only',
      access: 'Send email as you. It can’t read, change or delete your email.',
      account: 'The Google account you choose next.',
      company: 'Google',
    },
  ],
  [
    'notion',
    {
      scopes: '',
      summary: 'Search and edit pages in your workspace.',
      intro:
        'Your Tlonbot will be able to search your Notion pages and make changes for you.',
      accessMode: 'read and write',
      access: 'Read, create and edit pages in the Notion workspace you pick.',
      account: 'The Notion workspace you choose next.',
      company: 'Notion',
    },
  ],
];

export const firstRunCopy = {
  back: 'Back',
  stepLabel: (step: number) => `Step ${step} of ${FIRST_RUN_STEP_COUNT}`,

  meet: {
    title: 'Meet your Tlonbot.',
    accent: 'It works for you, and only you.',
    points: [
      {
        icon: 'people',
        title: 'Bring it into your chats',
        detail: 'Collaborate with friends in your workspaces.',
      },
      {
        icon: 'chat',
        title: 'Ask it anything',
        detail: 'Questions, web searches and reminders.',
      },
      {
        icon: 'plug',
        title: 'Connect your services',
        detail: 'Hook up the apps and services you already use.',
      },
    ] satisfies FeaturePoint[],
    primary: 'Next',
  },

  private: {
    title: 'Yours to keep.',
    accent: 'Private by design.',
    points: [
      {
        icon: 'computer',
        title: 'Lives on a computer you own',
        detail:
          'It runs on your own Tlon computer, and you can take it with you any time.',
      },
      {
        icon: 'lock',
        title: 'Zero data retention by default',
        detail:
          'By default, the AI company behind it keeps none of your messages.',
      },
      {
        icon: 'sliders',
        title: 'You’re in charge',
        detail: 'You choose who it talks to and what it sees.',
      },
    ] satisfies FeaturePoint[],
    primary: 'Next',
  },

  connect: {
    title: 'Connect your services.',
    accent: 'Choose one to get started.',
    body: 'Make your Tlonbot useful with the apps you already use.',
    footnote:
      'Your connected content is not automatically shared with other people.',
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
    title: 'Change models.',
    accent: 'Keep your context.',
    body: 'Switch any time without starting over. Your Tlonbot keeps its history and what it knows.',
    sectionIncluded: 'Included with Tlon',
    sectionSubscription: 'Use your subscription',
    sectionApiKey: 'Use your own API key',
    recommended: 'Recommended',
    includedMeta: 'Zero data retention on',
    subscriptionMeta: (company: string) =>
      `Sign in with your plan · ${company}’s data policy`,
    apiKeyName: 'OpenAI, Anthropic, xAI or OpenRouter',
    apiKeyMeta: 'Pay the provider directly',
    primaryIncluded: (model: string) => `Use ${model}`,
    primarySubscription: (plan: string) => `Sign in to ${plan}`,
    primaryApiKey: 'Add an API key',
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
    keep: (model: string) => `Keep ${model}`,
  },

  apiKey: {
    title: 'Add your',
    accent: 'API key.',
    body: 'Pick the provider, then paste your key. It’s stored on your Tlon computer.',
    providerLabel: 'Provider',
    keyLabel: (provider: string) => `${provider} API key`,
    keyPlaceholder: 'Paste your key here',
    paste: 'Paste',
    primary: 'Check key',
    checking: 'Checking…',
  },

  space: {
    title: 'Make space for something.',
    accent: 'A project. A friendship. An idea you haven’t figured out yet.',
    body: 'Start with your Tlonbot. Together, find something worth bringing into a private workspace.',
    primary: 'Let’s get started',
    artLabel:
      'Example: two phones showing a private workspace called Bike Parts. One shows Build chat, where Tlonbot has written a starting brief. The other shows the Parts gallery with three references.',
    // The example space drawn on the two phones.
    art: {
      chatTitle: 'Build chat',
      galleryTitle: 'Parts gallery',
      galleryAction: 'New',
      bot: 'Tlonbot',
      botBadge: 'Bot',
      friend: 'Sam',
      today: 'Today',
      messages: [
        {
          from: 'bot',
          lines: [
            'Goal: explore a gravel build and compare parts. Nothing has been selected yet.',
            'What bike or frame are you building around?',
          ],
        },
        { from: 'friend', lines: ['Which should I decide first?'] },
        {
          from: 'bot',
          lines: ['The frame. It sets how wide your tires can go.'],
        },
      ] as { from: 'bot' | 'friend'; lines: string[] }[],
      tiles: ['Drivetrain options', 'Tire clearance', 'Mounting options'],
    },
  },

  status: {
    running: 'Setting up your Tlonbot',
    ready: 'Your Tlonbot is ready',
  },

  setup: {
    // The screen keeps signup's "Setting up" title, so the canvas's "Getting
    // your Tlonbot ready…" leads the body instead.
    waitingBody:
      'Getting your Tlonbot ready… Your choices are saved, and your chat opens as soon as it’s ready.',
  },
};
