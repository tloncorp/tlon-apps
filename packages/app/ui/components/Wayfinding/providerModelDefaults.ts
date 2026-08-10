import type { TlawnProviderModel } from '@tloncorp/api';

export const OPENAI_ONBOARDING_DEFAULT_MODEL = 'gpt-5.6-luna';

export function resolveInitialProviderModel(
  provider: string,
  models: TlawnProviderModel[],
  currentModel: string
): string {
  if (models.some((model) => model.id === currentModel)) {
    return currentModel;
  }
  if (
    provider === 'openai' &&
    models.some((model) => model.id === OPENAI_ONBOARDING_DEFAULT_MODEL)
  ) {
    return OPENAI_ONBOARDING_DEFAULT_MODEL;
  }
  return '';
}
