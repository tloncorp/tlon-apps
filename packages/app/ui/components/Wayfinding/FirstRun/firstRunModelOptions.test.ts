import { describe, expect, it } from 'vitest';

import {
  INCLUDED_ROW_ID,
  SUBSCRIPTIONS_ROW_ID,
  botOnIncludedModel,
  buildFirstRunModelSections,
  buildModelChoiceRows,
  defaultModelRowId,
  findModelRow,
  modelChoiceRowId,
} from './firstRunModelOptions';

const hostedConfig = {
  keys: {},
  models: [],
  defaultKeys: { basic: { key: 'included' } },
  defaultModels: { primaryModel: 'openai/gpt-5.6-luna', fallbackModels: [] },
};

describe('first-run model choices', () => {
  it('offers the included model, three subscriptions, and one API key row', () => {
    const sections = buildFirstRunModelSections(hostedConfig);
    expect(sections.map((section) => section.key)).toEqual([
      'included',
      'subscription',
      'api-key',
    ]);
    expect(sections[1].rows.map((row) => row.name)).toEqual([
      'ChatGPT',
      'Claude',
      'Grok',
    ]);
    expect(sections[2].rows).toHaveLength(1);
  });

  it('recommends only the included model and starts on it', () => {
    const sections = buildFirstRunModelSections(hostedConfig);
    const recommended = sections
      .flatMap((section) => section.rows)
      .filter((row) => row.recommended);
    expect(recommended.map((row) => row.id)).toEqual([INCLUDED_ROW_ID]);
    expect(defaultModelRowId(sections)).toBe(INCLUDED_ROW_ID);
  });

  it('names the included model from hosting and keeps zero data retention on it alone', () => {
    const sections = buildFirstRunModelSections({
      ...hostedConfig,
      defaultModels: { primaryModel: 'openai/gpt-7-luna', fallbackModels: [] },
    });
    const included = findModelRow(sections, INCLUDED_ROW_ID);
    expect(included?.name).toBe('GPT-7 Luna');
    expect(included?.primaryLabel).toBe('Use GPT-7 Luna');
    expect(included?.meta).toBe('Included · Zero data retention');
    expect(
      sections
        .flatMap((section) => section.rows)
        .filter((row) => row.keepsZdr)
        .map((row) => row.id)
    ).toEqual([INCLUDED_ROW_ID]);
  });

  it('says whose data policy each subscription falls under', () => {
    const sections = buildFirstRunModelSections(hostedConfig);
    expect(findModelRow(sections, 'subscription:anthropic')?.meta).toBe(
      'Sign in with your plan · Anthropic’s data policy'
    );
    expect(findModelRow(sections, 'subscription:xai')?.primaryLabel).toBe(
      'Sign in to Grok'
    );
  });

  it('lists subscriptions before setup has finished', () => {
    // The Choose a brain step hides them until the bot is ready; here they
    // show, and their sign-in waits for the bot instead.
    const sections = buildFirstRunModelSections(hostedConfig);
    expect(sections.some((section) => section.key === 'subscription')).toBe(
      true
    );
  });

  it('assumes the included model while the hosting config is loading', () => {
    const sections = buildFirstRunModelSections(null);
    expect(findModelRow(sections, INCLUDED_ROW_ID)?.name).toBe('GPT-5.6 Luna');
  });

  it('leaves out the included model when the account has none', () => {
    const sections = buildFirstRunModelSections({
      ...hostedConfig,
      defaultKeys: {},
    });
    expect(findModelRow(sections, INCLUDED_ROW_ID)).toBeUndefined();
    expect(defaultModelRowId(sections)).toBe('subscription:openai');
  });
});

describe('the model screen rows', () => {
  it('shows one row for every subscription, carrying its plans', () => {
    const rows = buildModelChoiceRows(buildFirstRunModelSections(hostedConfig));
    expect(rows.map((row) => row.id)).toEqual([
      INCLUDED_ROW_ID,
      SUBSCRIPTIONS_ROW_ID,
      'api-key',
    ]);
    const subscriptions = rows[1];
    expect(subscriptions.name).toBe('Your subscription');
    expect(subscriptions.meta).toBe('Sign in with ChatGPT, Claude or Grok');
    expect(subscriptions.primaryLabel).toBe('Sign in to your subscription');
    expect(subscriptions.plans?.map((plan) => plan.id)).toEqual([
      'subscription:openai',
      'subscription:anthropic',
      'subscription:xai',
    ]);
    expect(rows[2].name).toBe('Your own API key');
    expect(rows[2].primaryLabel).toBe('Add your API key');
  });

  it('selects the subscription row for any of its plans', () => {
    expect(modelChoiceRowId('subscription:anthropic')).toBe(
      SUBSCRIPTIONS_ROW_ID
    );
    expect(modelChoiceRowId(INCLUDED_ROW_ID)).toBe(INCLUDED_ROW_ID);
  });
});

describe('the model the first run starts from', () => {
  it('assumes the included model until the config loads', () => {
    expect(botOnIncludedModel(null)).toBe(true);
    expect(botOnIncludedModel(undefined)).toBe(true);
  });

  it('reads a new account as on the included model', () => {
    expect(botOnIncludedModel(hostedConfig)).toBe(true);
    expect(
      botOnIncludedModel({
        ...hostedConfig,
        models: [
          {
            provider: 'basic',
            model: 'openai/gpt-5.6-luna',
            primary: true,
            zdr: true,
          },
        ],
      })
    ).toBe(true);
  });

  it('sees a model saved by an earlier, unfinished first run', () => {
    // Someone saved their own key, closed the app on Make space, and came
    // back: continuing with the included model has to switch the bot.
    expect(
      botOnIncludedModel({
        ...hostedConfig,
        keys: { anthropic: 'sk-ant-…' },
        models: [
          { provider: 'anthropic', model: 'claude-sonnet-5', primary: true },
          { provider: 'basic', model: 'openai/gpt-5.6-luna' },
        ],
      })
    ).toBe(false);
  });

  it('ignores models set only for some channels', () => {
    expect(
      botOnIncludedModel({
        ...hostedConfig,
        models: [
          { provider: 'basic', model: 'openai/gpt-5.6-luna', primary: true },
          {
            provider: 'openai',
            model: 'gpt-5.6',
            channels: ['chat/~zod/build'],
          },
        ],
      })
    ).toBe(true);
  });
});
