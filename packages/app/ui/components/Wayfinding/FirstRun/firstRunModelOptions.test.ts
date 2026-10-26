import { describe, expect, it } from 'vitest';

import {
  INCLUDED_ROW_ID,
  buildFirstRunModelSections,
  defaultModelRowId,
  findModelRow,
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
    expect(included?.meta).toBe('Zero data retention on');
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
