import type { TlawnProviderConfigInfo } from '@tloncorp/api';

import {
  EMPTY_PROVIDER_CONFIG,
  type SubscriptionProvider,
  getIncludedModelId,
  getModelName,
  isSubscriptionProvider,
  subscriptionProviderLabel,
} from '../../../../features/settings/bot/constants';
import { buildBotCredentialOptions } from '../botProviderOptions';
import { firstRunCopy } from './firstRunCopy';

export type FirstRunModelChoice =
  | { kind: 'included' }
  | { kind: 'subscription'; provider: SubscriptionProvider }
  | { kind: 'api-key' };

export type FirstRunModelRow = {
  id: string;
  choice: FirstRunModelChoice;
  name: string;
  meta: string;
  recommended: boolean;
  /** Whether this keeps zero data retention; anything else asks first. */
  keepsZdr: boolean;
  primaryLabel: string;
};

export type FirstRunModelSection = {
  key: 'included' | 'subscription' | 'api-key';
  title: string;
  rows: FirstRunModelRow[];
};

export const INCLUDED_ROW_ID = 'included';

const COMPANY: Record<SubscriptionProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  xai: 'xAI',
};

export const subscriptionCompany = (provider: SubscriptionProvider) =>
  COMPANY[provider];

/** The included model's name as people know it, from what hosting runs. */
export const includedModelName = (config?: TlawnProviderConfigInfo) =>
  getModelName(getIncludedModelId(config));

/**
 * Screen 4's three ways to get a model, built from the same options as the
 * app's Choose a brain step: the included model (recommended, zero data
 * retention on), each subscription, and one row for bringing your own key.
 *
 * Subscriptions are listed even while setup is still running. Their sign-in
 * waits for the bot, and the confirmation sheet says so.
 */
export function buildFirstRunModelSections(
  providerConfig?: TlawnProviderConfigInfo | null
): FirstRunModelSection[] {
  const copy = firstRunCopy.model;
  const options = buildBotCredentialOptions({
    providerConfig: providerConfig ?? EMPTY_PROVIDER_CONFIG,
    botReady: true,
    mode: 'signup',
  });
  const included = options.find(
    (option) =>
      option.provider === 'basic' && option.credentialMode === 'included'
  );
  // Before the config arrives, assume hosting's default: every hosted
  // account has the included model.
  const showIncluded = !providerConfig || !!included;
  const modelName = includedModelName(providerConfig ?? undefined);

  const sections: FirstRunModelSection[] = [];
  if (showIncluded) {
    sections.push({
      key: 'included',
      title: copy.sectionIncluded,
      rows: [
        {
          id: INCLUDED_ROW_ID,
          choice: { kind: 'included' },
          name: modelName,
          meta: copy.includedMeta,
          recommended: true,
          keepsZdr: true,
          primaryLabel: copy.primaryIncluded(modelName),
        },
      ],
    });
  }

  const subscriptionRows = options
    .filter((option) => option.credentialMode === 'subscription')
    .flatMap((option): FirstRunModelRow[] => {
      if (!isSubscriptionProvider(option.provider)) return [];
      const plan = subscriptionProviderLabel(option.provider);
      return [
        {
          id: `subscription:${option.provider}`,
          choice: { kind: 'subscription', provider: option.provider },
          name: plan,
          meta: copy.subscriptionMeta(COMPANY[option.provider]),
          recommended: false,
          keepsZdr: false,
          primaryLabel: copy.primarySubscription(plan),
        },
      ];
    });
  if (subscriptionRows.length) {
    sections.push({
      key: 'subscription',
      title: copy.sectionSubscription,
      rows: subscriptionRows,
    });
  }

  if (options.some((option) => option.credentialMode === 'api-key')) {
    sections.push({
      key: 'api-key',
      title: copy.sectionApiKey,
      rows: [
        {
          id: 'api-key',
          choice: { kind: 'api-key' },
          name: copy.apiKeyName,
          meta: copy.apiKeyMeta,
          recommended: false,
          keepsZdr: false,
          primaryLabel: copy.primaryApiKey,
        },
      ],
    });
  }

  return sections;
}

export function findModelRow(
  sections: FirstRunModelSection[],
  id: string
): FirstRunModelRow | undefined {
  for (const section of sections) {
    const row = section.rows.find((candidate) => candidate.id === id);
    if (row) return row;
  }
  return undefined;
}

/** The row to start on: the recommended one, else the first offered. */
export function defaultModelRowId(sections: FirstRunModelSection[]) {
  const rows = sections.flatMap((section) => section.rows);
  return (rows.find((row) => row.recommended) ?? rows[0])?.id ?? '';
}

/** The providers someone can bring a key for, in the order to show them. */
export const API_KEY_PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'xai', label: 'xAI' },
  { id: 'openrouter', label: 'OpenRouter' },
] as const;
