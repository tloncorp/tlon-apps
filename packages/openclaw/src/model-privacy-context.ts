// Which model a run is using, how its requests reach it, and whether they're
// kept. Hosting turns zero data retention on by routing an OpenRouter model
// (the included Basic model among them) only to providers that retain
// nothing, and nothing else in the bot's context says any of this. Without
// this line the bot guesses when asked, down to inventing a model service.

type ModelEntry = { params?: { provider?: { zdr?: unknown } } };
type ConfigWithModels = {
  agents?: { defaults?: { models?: Record<string, ModelEntry | undefined> } };
};

const ROUTED_PROVIDER = 'openrouter';

// OpenClaw is the bot's software, and a bot asked what powers it otherwise
// names that instead of the model.
const ASKED =
  ' When asked what model or company you run on, or whether you are ' +
  'connected to OpenAI or any other AI company, answer from this note: name ' +
  'the model and the route. OpenClaw is the software you run in, not a model ' +
  'service.';

// The note answers only for the provider, and a bot asked about retention
// would otherwise answer from it alone and leave Tlon's side out.
const TLON_SIDE =
  " That covers the model provider only: for Tlon's side, read the " +
  'tlon-product-guide privacy page.';

export function modelPrivacyNote(
  config: unknown,
  provider: string | undefined,
  model: string | undefined
): string | undefined {
  if (!provider || !model) return undefined;
  if (provider !== ROUTED_PROVIDER) {
    return (
      `Model: you're running ${model}, with requests sent to ${provider} ` +
      "directly under that provider's own data policy. Zero data retention " +
      'settings only apply to models routed through OpenRouter, including ' +
      'the included Basic model.' +
      ASKED +
      TLON_SIDE
    );
  }
  const models = (config as ConfigWithModels | undefined)?.agents?.defaults
    ?.models;
  const zdr = models?.[`${provider}/${model}`]?.params?.provider?.zdr === true;
  const running = `Model: you're running ${model}, routed through OpenRouter. `;
  return zdr
    ? running +
        'Zero data retention is on: OpenRouter only sends requests to ' +
        'companies serving the model that keep no data.' +
        ASKED +
        TLON_SIDE
    : running +
        'Zero data retention is off: OpenRouter routes each request to a ' +
        'company serving the model, which may keep it under its own policy. ' +
        "That can be the owner's choice: some models are only served by " +
        'companies that keep data. On a hosted account the owner sets it in ' +
        'settings.' +
        ASKED +
        TLON_SIDE;
}
