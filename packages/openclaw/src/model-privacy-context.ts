// Whether the model a run is using keeps the owner's requests. Hosting turns
// zero data retention on by routing an OpenRouter model (the included Basic
// model among them) only to providers that retain nothing, and nothing else in
// the bot's context says so. Without this line the bot guesses when asked.

type ModelEntry = { params?: { provider?: { zdr?: unknown } } };
type ConfigWithModels = {
  agents?: { defaults?: { models?: Record<string, ModelEntry | undefined> } };
};

const ROUTED_PROVIDER = 'openrouter';

export function modelPrivacyNote(
  config: unknown,
  provider: string | undefined,
  model: string | undefined
): string | undefined {
  if (!provider || !model) return undefined;
  if (provider !== ROUTED_PROVIDER) {
    return (
      `Data retention: you're running ${provider}/${model}, which goes to ` +
      `${provider} directly under that provider's own data policy. Zero data ` +
      'retention settings only apply to models routed through OpenRouter, ' +
      'including the included Basic model.'
    );
  }
  const models = (config as ConfigWithModels | undefined)?.agents?.defaults
    ?.models;
  const zdr = models?.[`${provider}/${model}`]?.params?.provider?.zdr === true;
  return zdr
    ? `Data retention: zero data retention is on for ${provider}/${model}, ` +
        'the model you are running now. Requests only go to model providers ' +
        'that keep no data.'
    : `Data retention: zero data retention is off for ${provider}/${model}, ` +
        'the model you are running now, so the model provider may keep ' +
        'requests under its own policy. On a hosted account the owner can ' +
        'turn it on in settings.';
}
